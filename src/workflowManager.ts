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

export class WorkflowManager {
  private components: Map<string, EnterpriseComponent> = new Map();
  private workflows: Map<string, WorkflowStep[]> = new Map();

  public registerComponent(comp: EnterpriseComponent) {
    this.components.set(comp.componentId, comp);
  }

  public getComponent(componentId: string): EnterpriseComponent | undefined {
    return this.components.get(componentId);
  }

  // Update component locators when edited from the UI
  public updateComponentLocators(componentId: string, locators: string[]) {
    const comp = this.components.get(componentId);
    if (comp) {
      comp.locators = locators;
      this.components.set(componentId, comp);
    }
  }

  public createWorkflow(workflowId: string, steps: WorkflowStep[]) {
    this.workflows.set(workflowId, steps);
  }

  public getWorkflow(workflowId: string): WorkflowStep[] {
    const flow = this.workflows.get(workflowId);
    if (!flow) throw new Error(`Workflow ${workflowId} not found.`);
    return flow;
  }
}