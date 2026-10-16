// src/workflowManager.ts
import fs from 'fs';
import path from 'path';

export interface EnterpriseComponent {
  componentId: string;
  name: string;
  locators: string[];
  framePath?: string[];
}

export interface WorkflowStep {
  instanceId: string;
  componentId?: string;
  action: string;
  testDataTemplate?: string;
}

export interface WorkflowFileSchema {
  workflowId: string;
  steps: WorkflowStep[];
  components: Record<string, EnterpriseComponent>;
}

export class WorkflowManager {
  private components: Map<string, EnterpriseComponent> = new Map();
  private workflows: Map<string, WorkflowStep[]> = new Map();
  private storageDir = path.join(process.cwd(), 'workflows');

  constructor() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    this.loadAllFromDisk();
  }

  private loadAllFromDisk() {
    try {
      if (!fs.existsSync(this.storageDir)) return;
      const files = fs.readdirSync(this.storageDir).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        const filePath = path.join(this.storageDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data: WorkflowFileSchema = JSON.parse(content);
        
        if (data.workflowId && data.steps) {
          this.workflows.set(data.workflowId, data.steps);
          if (data.components) {
            for (const [id, comp] of Object.entries(data.components)) {
              this.components.set(id, comp);
            }
          }
        }
      }
      console.log(`📂 [WorkflowManager] Loaded ${files.length} workflow(s) from local storage.`);
    } catch (err) {
      console.error('❌ Error loading workflows from disk:', err);
    }
  }

  public registerComponent(comp: EnterpriseComponent) {
    this.components.set(comp.componentId, comp);
  }

  public getComponent(componentId: string): EnterpriseComponent | undefined {
    return this.components.get(componentId);
  }

  public updateComponentLocators(componentId: string, locators: string[]) {
    const comp = this.components.get(componentId);
    if (comp) {
      comp.locators = locators;
      this.components.set(componentId, comp);
    }
  }

  public createWorkflow(workflowId: string, steps: WorkflowStep[]) {
    this.workflows.set(workflowId, steps);
    this.saveWorkflowToDisk(workflowId, steps);
  }

  public getWorkflow(workflowId: string): WorkflowStep[] {
    let flow = this.workflows.get(workflowId);
    
    if (!flow) {
      const filePath = path.join(this.storageDir, `${workflowId}.json`);
      if (fs.existsSync(filePath)) {
        const data: WorkflowFileSchema = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        flow = data.steps;
        this.workflows.set(workflowId, flow);
        if (data.components) {
          for (const [id, comp] of Object.entries(data.components)) {
            this.components.set(id, comp);
          }
        }
      }
    }

    if (!flow) throw new Error(`Workflow ${workflowId} not found.`);
    return flow;
  }

  public listWorkflows(): string[] {
    if (!fs.existsSync(this.storageDir)) return [];
    return fs.readdirSync(this.storageDir)
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));
  }

  public saveWorkflowToDisk(workflowId: string, steps: WorkflowStep[]) {
    const filePath = path.join(this.storageDir, `${workflowId}.json`);
    
    const workflowComponents: Record<string, EnterpriseComponent> = {};
    for (const step of steps) {
      if (step.componentId) {
        const comp = this.components.get(step.componentId);
        if (comp) {
          workflowComponents[step.componentId] = comp;
        }
      }
    }

    const fileData: WorkflowFileSchema = {
      workflowId,
      steps,
      components: workflowComponents
    };

    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf-8');
    console.log(`💾 [WorkflowManager] Successfully saved workflow "${workflowId}" to disk.`);
  }

  public deleteWorkflow(workflowId: string): void {
    const filePath = path.join(this.storageDir, `${workflowId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.workflows.delete(workflowId);
    console.log(`🗑️ [WorkflowManager] Deleted workflow "${workflowId}" from disk.`);
  }

  public renameWorkflow(oldId: string, newId: string): void {
    const oldPath = path.join(this.storageDir, `${oldId}.json`);
    const newPath = path.join(this.storageDir, `${newId}.json`);

    if (fs.existsSync(oldPath)) {
      const content = fs.readFileSync(oldPath, 'utf-8');
      const data: WorkflowFileSchema = JSON.parse(content);
      data.workflowId = newId;

      fs.writeFileSync(newPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.unlinkSync(oldPath);

      const steps = this.workflows.get(oldId);
      if (steps) {
        this.workflows.set(newId, steps);
        this.workflows.delete(oldId);
      }
      console.log(`✏️ [WorkflowManager] Renamed workflow from "${oldId}" to "${newId}".`);
    }
  }
}