export interface NodeDescription {
  title: string;
  description: string;
}

export function generateNodeNL(action: string, testData: string, locators: string[]): NodeDescription {
  const primaryLocator = locators[0] || 'element';
  
  // Extract a readable human name from the primary locator
  let targetName = 'target element';
  
  if (primaryLocator.startsWith('#')) {
    targetName = primaryLocator.substring(1).replace(/[-_]/g, ' ');
  } else if (primaryLocator.includes('data-testid=')) {
    const match = primaryLocator.match(/data-testid="([^"]+)"/);
    if (match) targetName = match[1].replace(/[-_]/g, ' ');
  } else if (primaryLocator.startsWith('text=')) {
    targetName = primaryLocator.replace(/text="|"/g, '');
  } else if (primaryLocator.includes('.')) {
    const parts = primaryLocator.split('.');
    targetName = parts[parts.length - 1].replace(/[-_]/g, ' ');
  } else {
    targetName = primaryLocator.replace(/[#._\[\]="'-]/g, ' ').trim();
  }

  if (!targetName || targetName.length < 2) {
    targetName = 'element';
  }

  // Generate clean natural language based on action type
  switch (action) {
    case 'navigate':
      return {
        title: `Navigate to URL`,
        description: `Open browser and navigate to target URL: ${testData || primaryLocator}`
      };
    case 'click':
      return {
        title: `Click on "${targetName}"`,
        description: `Click the ${targetName} component.`
      };
    case 'dblclick':
      return {
        title: `Double-click "${targetName}"`,
        description: `Perform a double-click interaction on the ${targetName} element.`
      };
    case 'type':
      return {
        title: `Type into "${targetName}"`,
        description: `Enter test data value "${testData || '***'}" into the ${targetName} field.`
      };
    case 'hover':
      return {
        title: `Hover over "${targetName}"`,
        description: `Move mouse pointer over the ${targetName} menu item or dropdown container.`
      };
    case 'waitForSelector':
      return {
        title: `Wait for "${targetName}"`,
        description: `Pause test execution until the ${targetName} element becomes visible on page.`
      };
    case 'viewport':
      return {
        title: `Set Viewport Resolution`,
        description: `Resize browser window viewport dimensions to width/height: ${testData || 'default'}.`
      };
    case 'scroll':
      return {
        title: `Scroll Page`,
        description: `Scroll down page content or to specific element view coordinates.`
      };
    case 'fileUpload':
      return {
        title: `Upload File to "${targetName}"`,
        description: `Attach test file asset into the ${targetName} upload input.`
      };
    default:
      return {
        title: `Execute ${action} on "${targetName}"`,
        description: `Perform step action "${action}" targeting ${targetName}.`
      };
  }
}