import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parseEnterpriseRecorder } from './advancedParser';
import { WorkflowManager, WorkflowStep } from './workflowManager';
import { WorkflowExecutionEngine } from './workflowExecutor';
import { chromium } from 'playwright';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const manager = new WorkflowManager();

// 1. List all stored workflows for the left sidebar
app.get('/api/workflows', (req, res) => {
  try {
    const workflows = manager.listWorkflows();
    res.json({ success: true, workflows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Load a specific workflow file
app.get('/api/workflow/:workflowId', (req, res) => {
  const { workflowId } = req.params;
  try {
    const steps = manager.getWorkflow(workflowId);

    const enrichedNodes = steps.map(step => {
      const comp = step.componentId ? manager.getComponent(step.componentId) : null;
      return {
        ...step,
        name: comp ? comp.name : (step.action === 'navigate' ? 'Navigate' : 'Action Step'),
        locators: comp ? comp.locators : [],
        framePath: comp ? comp.framePath : undefined,
        testData: step.testDataTemplate || ''
      };
    });

    res.json({
      success: true,
      workflowId,
      nodes: enrichedNodes
    });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// 3. Explicit Save Workflow Route
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
    res.json({ success: true, message: 'Workflow saved successfully to disk!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete Workflow Route
app.delete('/api/workflow/:workflowId', (req, res) => {
  const { workflowId } = req.params;
  try {
    manager.deleteWorkflow(workflowId);
    res.json({ success: true, message: `Workflow "${workflowId}" deleted successfully.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Rename Workflow Route
app.post('/api/workflow/:workflowId/rename', (req, res) => {
  const { workflowId } = req.params;
  const { newFilename } = req.body;
  
  try {
    if (!newFilename || typeof newFilename !== 'string' || newFilename.trim() === '') {
      return res.status(400).json({ error: 'Valid filename is required.' });
    }

    const cleanNewId = newFilename.trim().replace(/\.json$/, '');
    manager.renameWorkflow(workflowId, cleanNewId);
    
    res.json({ success: true, message: `Workflow renamed to "${cleanNewId}" successfully.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Upload & Parse Chrome Recorder JSON
app.post('/api/upload-recorder', upload.single('recorderFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const originalName = req.file.originalname || `wf_${Date.now()}.json`;
    const baseName = originalName.replace(/\.[^/.]+$/, ''); 
    const workflowId = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');

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

    manager.createWorkflow(workflowId, workflowSteps);

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

// 7. Execute Workflow via Playwright & Return Network Logs
app.post('/api/execute/:workflowId', async (req, res) => {
  const { workflowId } = req.params;
  const { dataContext } = req.body;

  try {
    const engine = new WorkflowExecutionEngine(manager);
    const result = await engine.execute(workflowId, dataContext || {}, false);
    
    res.json({ 
      success: true, 
      message: 'Workflow executed successfully!',
      networkLogs: result.networkLogs || {} 
    });
  } catch (error: any) {
    console.error('Execution error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Record/Pick Hover Element (Multi-Locator Self-Healing Capture)
app.post('/api/record-hover', async (req, res) => {
  try {
    const { startUrl } = req.body;
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    let capturedSelectors: string[] = [];

    // 1. Expose bridge function to capture multiple fallback selectors
    await page.exposeBinding('captureHoverSelectors', async () => {
      try {
        const selectors = await page.evaluate(() => {
          const hovered = document.querySelectorAll(':hover');
          const el = hovered.length > 0 ? hovered[hovered.length - 1] : document.activeElement;

          if (!el) return ['body'];

          const list: string[] = [];

          // Strategy 1: ID-based selector (Highest priority)
          if (el.id) {
            list.push(`#${el.id}`);
          }

          // Strategy 2: Data attributes (e.g., data-testid, data-action)
          for (const attr of Array.from(el.attributes)) {
            if (attr.name.startsWith('data-') && attr.value) {
              list.push(`[${attr.name}="${attr.value}"]`);
            }
          }

          // Strategy 3: Class-based selector
          if (el.className && typeof el.className === 'string' && el.className.trim() !== '') {
            const cleanClasses = el.className.trim().split(/\s+/).filter(c => !c.match(/hover|active|focus|open/i));
            if (cleanClasses.length > 0) {
              list.push(`${el.tagName.toLowerCase()}.${cleanClasses[0]}`);
            }
          }

          // Strategy 4: Text-based content selector
          if (el.textContent && el.textContent.trim().length > 0 && el.textContent.trim().length < 30) {
            list.push(`text="${el.textContent.trim()}"`);
          }

          // Strategy 5: Generic tag fallback
          list.push(el.tagName.toLowerCase());

          // Deduplicate and return array
          return Array.from(new Set(list));
        });

        capturedSelectors = selectors;
      } catch (e) {
        capturedSelectors = ['body'];
      }
    });

    // 2. Init script to inject banner and handle Ctrl + Space across page navigations/logins
    await page.addInitScript(() => {
      window.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('autoflow-hover-box')) return;
        const box = document.createElement('div');
        box.id = 'autoflow-hover-box';
        box.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#1e1b4b;border:2px solid #6366f1;color:white;padding:12px 20px;font-family:sans-serif;font-size:13px;z-index:999999;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.5);text-align:center;pointer-events:none;';
        box.innerHTML = `
          <div style="font-weight:bold;margin-bottom:4px;color:#818cf8;">⚡ AutoFlow Hover Studio (Self-Healing)</div>
          <div style="font-size:11px;color:#cbd5e1;">Navigate freely. Press <b>Ctrl + Space</b> on your target item to capture fallback locators!</div>
        `;
        document.body.appendChild(box);
      });

      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.code === 'Space') {
          e.preventDefault();
          (window as any).captureHoverSelectors();
        }
      }, true);
    });

    await page.goto(startUrl || 'http://localhost:3000');
    console.log('🔍 [Hover Inspector] Browser opened. Log in, navigate, open your menu, and press Ctrl + Space.');

    // 3. Wait for capture
    while (capturedSelectors.length === 0) {
      if (!browser.isConnected()) {
        capturedSelectors = ['CANCELLED'];
        break;
      }
      await new Promise(r => setTimeout(r, 400));
    }

    try {
      await browser.close();
    } catch (e) {}

    if (capturedSelectors.length === 0 || capturedSelectors[0] === 'CANCELLED') {
      return res.json({ success: false, error: 'Hover capture was cancelled or failed.' });
    }

    console.log(`✅ [Hover Inspector] Captured self-healing locators:`, capturedSelectors);
    res.json({
      success: true,
      selectors: capturedSelectors
    });
  } catch (error: any) {
    console.error('Hover Inspector Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Studio Server running at http://localhost:${PORT}`);
});