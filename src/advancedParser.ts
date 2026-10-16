// src/advancedParser.ts
export interface RecorderStep {
  type: string;
  url?: string;
  selectors?: string[][];
  value?: string;
  x?: number;
  y?: number;
  frame?: string[];
}

export interface EnterpriseNode {
  nodeId: string;
  name: string;
  action: string;
  selectors: string[];
  framePath?: string[];
  testData?: string;
}

export function parseEnterpriseRecorder(rawJson: { title: string; steps: RecorderStep[] }) {
  const nodes: EnterpriseNode[] = [];

  rawJson.steps.forEach((step, index) => {
    const nodeId = `node_${index + 1}`;
    let action = step.type;
    const selectors = step.selectors ? step.selectors.flat() : [];
    let testData = step.value || step.url || '';

    // Detect file upload events from Chrome Recorder
    const isFileUploadEvent = 
      step.type === 'change' && (
        (step.value && step.value.includes('fakepath')) ||
        selectors.some(s => s.includes('type="file"') || s.includes('input[type="file"]') || s.toLowerCase().includes('upload'))
      );

    if (isFileUploadEvent) {
      action = 'fileUpload';
      // Leave a placeholder hint so you know to put your absolute file path here in the UI Studio
      testData = 'C:/path/to/your/file.pdf'; 
    } else {
      switch (step.type) {
        case 'navigate':
          action = 'navigate';
          break;
        case 'click':
        case 'doubleClick':
          action = step.type === 'doubleClick' ? 'dblclick' : 'click';
          break;
        case 'change':
          action = 'type';
          break;
        case 'hover':
          action = 'hover';
          break;
        case 'scroll':
          action = 'scroll';
          break;
        case 'waitForElement':
          action = 'waitForSelector';
          break;
        case 'keyDown':
          action = 'press';
          break;
        case 'upload':
          action = 'fileUpload';
          break;
        default:
          action = step.type;
      }
    }

    nodes.push({
      nodeId,
      name: `${action}_target_${index}`,
      action,
      selectors,
      framePath: step.frame,
      testData,
    });
  });

  return { testName: rawJson.title, nodes };
}