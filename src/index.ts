import { parseEnterpriseRecorder } from './advancedParser';
import { WorkflowManager, WorkflowStep } from './workflowManager';
import { WorkflowExecutionEngine } from './workflowExecutor';

const mockChromeRecording = {
  title: 'Enterprise Login & Verification Flow',
  steps: [
    { type: 'navigate', url: 'https://the-internet.herokuapp.com/login' },
    { type: 'change', selectors: [['#username'], ['//input[@id=\'username\']']], value: '${user.username}' },
    { type: 'change', selectors: [['#password'], ['//input[@id=\'password\']']], value: '${user.password}' },
    { type: 'click', selectors: [['button[type=\'submit\']'], ['//button[@type=\'submit\']']] }
  ]
};

async function main() {
  const manager = new WorkflowManager();
  
  console.log('📦 Parsing Chrome Recorder payload...');
  const parsed = parseEnterpriseRecorder(mockChromeRecording);

  parsed.nodes.forEach((node, idx) => {
    manager.registerComponent({
      componentId: `comp_${idx + 1}`,
      name: node.name,
      locators: node.selectors,
      framePath: node.framePath
    });
  });

  const workflowSteps: WorkflowStep[] = [
    { instanceId: 's1', action: 'navigate', testDataTemplate: mockChromeRecording.steps[0].url },
    { instanceId: 's2', componentId: 'comp_2', action: 'type', testDataTemplate: '${user.username}' },
    { instanceId: 's3', componentId: 'comp_3', action: 'type', testDataTemplate: '${user.password}' },
    { instanceId: 's4', componentId: 'comp_4', action: 'click' },
  ];

  manager.createWorkflow('enterprise_login_test', workflowSteps);

  const testDataSet = {
    user: {
      username: 'tomsmith',
      password: 'SuperSecretPassword!',
    },
  };

  const engine = new WorkflowExecutionEngine(manager);
  await engine.execute('enterprise_login_test', testDataSet, false);
}

main().catch(console.error);