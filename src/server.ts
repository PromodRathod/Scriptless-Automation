// src/server.ts
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parseEnterpriseRecorder } from './advancedParser';
import { WorkflowManager, WorkflowStep } from './workflowManager';
import { WorkflowExecutionEngine } from './workflowExecutor';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const manager = new WorkflowManager();

// 1. Upload & Parse Chrome Recorder JSON
app.post('/api/upload-recorder', upload.single('recorderFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const rawJson = JSON.parse(fileContent);
    const parsed = parseEnterpriseRecorder(rawJson);

    const workflowSteps: WorkflowStep[] = [];
    parsed.nodes.forEach((node, idx) => {
      const componentId = `comp_${Date.now()}_${idx}`;
      
      manager.registerComponent({
        componentId,
        name: node.name,
        locators: node.selectors && node.selectors.length > 0 ? node.selectors : ['body'],
        framePath: node.framePath
      });

      workflowSteps.push({
        instanceId: `step_${idx}`,
        componentId: node.action === 'navigate' ? undefined : componentId,
        action: node.action,
        testDataTemplate: node.testData
      });
    });

    const workflowId = `wf_${Date.now()}`;
    manager.createWorkflow(workflowId, workflowSteps);

    // Send nodes along with their component locators for the frontend
    const enrichedNodes = workflowSteps.map(step => {
      const comp = step.componentId ? manager.getComponent(step.componentId) : null;
      return {
        ...step,
        locators: comp ? comp.locators : []
      };
    });

    res.json({
      success: true,
      message: `Successfully parsed "${parsed.testName}" with ${parsed.nodes.length} steps!`,
      workflowId,
      nodes: enrichedNodes
    });
  } catch (error: any) {
    console.error('Parsing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Update / Save Workflow & Component Locators
app.put('/api/workflow/:workflowId', (req, res) => {
  const { workflowId } = req.params;
  const { nodes } = req.body;

  try {
    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Invalid nodes payload.' });
    }

    const processedSteps: WorkflowStep[] = nodes.map((node: any, idx: number) => {
      let componentId = node.componentId;

      if (node.action !== 'navigate') {
        if (!componentId || !manager.getComponent(componentId)) {
          componentId = `auto_comp_${Date.now()}_${idx}`;
          manager.registerComponent({
            componentId,
            name: `Auto Component ${idx}`,
            locators: node.locators || ['input', 'button', 'a', 'body']
          });
        } else if (node.locators) {
          // Update component fallback locators if modified in UI
          manager.updateComponentLocators(componentId, node.locators);
        }
      }

      return {
        instanceId: node.instanceId || `step_${idx}`,
        componentId: node.action === 'navigate' ? undefined : componentId,
        action: node.action,
        testDataTemplate: node.testDataTemplate || node.testData || ''
      };
    });

    manager.createWorkflow(workflowId, processedSteps);
    res.json({ success: true, message: 'Workflow state synchronized successfully!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Execute Workflow via Playwright with Advanced Debugging
app.post('/api/execute/:workflowId', async (req, res) => {
  const { workflowId } = req.params;
  const { dataContext } = req.body;

  try {
    const engine = new WorkflowExecutionEngine(manager);
    await engine.execute(workflowId, dataContext || {}, false);
    res.json({ success: true, message: 'Workflow executed successfully!' });
  } catch (error: any) {
    console.error('Execution error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Studio Server running at http://localhost:${PORT}`);
});