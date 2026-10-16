// src/enterpriseExecutor.ts
import { chromium, Page, Frame } from 'playwright';
import { WorkflowManager } from './workflowManager';

export class WorkflowExecutionEngine {
  constructor(private manager: WorkflowManager) {}

  private resolveData(template: string, context: Record<string, any>): string {
    if (!template) return '';
    return template.replace(/\${([^}]+)}/g, (_, key) => {
      return key.split('.').reduce((obj: { [x: string]: any; }, i: string | number) => (obj ? obj[i] : ''), context) || '';
    });
  }

  // Enhanced Self-Healing with deep diagnostic logging for each fallback
  private async findWorkingElement(page: Page, frame: Frame | Page, locators: string[]): Promise<string | null> {
    console.log(`🔍 [Self-Healing Engine] Evaluating ${locators.length} fallback locator(s):`, locators);

    for (let i = 0; i < locators.length; i++) {
      const locator = locators[i];
      try {
        console.log(`   Attempt [${i + 1}/${locators.length}]: Trying locator -> "${locator}"`);
        await frame.waitForSelector(locator, { timeout: 2000, state: 'visible' });
        console.log(`   ✅ Success! Working locator found: "${locator}"`);
        return locator;
      } catch (err: any) {
        console.log(`   ❌ Failed on "${locator}". Reason: ${err.message.split('\n')[0]}`);
      }
    }
    return null;
  }

  private async getTargetContext(page: Page, framePath?: string[]): Promise<Page | Frame> {
    if (!framePath || framePath.length === 0) return page;
    let currentFrame: Frame | Page = page;
    for (const selector of framePath) {
      const el:any = await currentFrame.$(selector);
      const frame:any = el ? await el.contentFrame() : null;
      if (frame) currentFrame = frame;
    }
    return currentFrame;
  }

  public async execute(workflowId: string, dataContext: Record<string, any>, headless = false) {
    const steps = this.manager.getWorkflow(workflowId);
    const browser = await chromium.launch({ headless });
    const context = await browser.newContext();
    let activePage: Page = await context.newPage();

    context.on('page', async (newPage) => {
      console.log(`📑 New popup/tab detected, switching context...`);
      await newPage.waitForLoadState();
      activePage = newPage;
    });

    activePage.on('dialog', async dialog => {
      console.log(`💬 Auto-accepting browser dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    console.log(`🚀 Starting Enterprise Execution: ${workflowId}`);
    let executionFailed = false;

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const resolvedValue = this.resolveData(step.testDataTemplate || '', dataContext);

        // Human-like delay between normal steps
        await activePage.waitForTimeout(3000);

        if (step.action === 'navigate') {
          console.log(`🌐 [Step ${i + 1}] Navigating to: ${resolvedValue}`);
          await activePage.goto(resolvedValue);
          continue;
        }

        if (step.action === 'waitForEvent' || step.action === 'popup') {
          console.log(`⏳ [Step ${i + 1}] Awaiting window event...`);
          await context.waitForEvent('page', { timeout: 3000 }).catch(() => {});
          continue;
        }

        if (!step.componentId) continue;
        const component = this.manager.getComponent(step.componentId);
        if (!component) throw new Error(`Component missing for ID: ${step.componentId}`);

        console.log(`\n----------------------------------------`);
        console.log(`⚡ [Step ${i + 1}] Action: ${step.action} | Component: ${component.name}`);

        const targetContext = await this.getTargetContext(activePage, component.framePath);
        
        // --- ENTERPRISE FILE UPLOAD HANDLER ---
        if (step.action === 'fileUpload' || step.action === 'upload') {
          console.log(`📁 [File Upload Handler] Processing upload for component [${component.name}] with path: ${resolvedValue}`);
          
          if (!resolvedValue) {
            throw new Error(`File upload failed: No file path specified in test data for component [${component.name}].`);
          }

          let uploadedSuccessfully = false;

          // 1. Try finding an explicit input[type="file"] first
          for (const loc of component.locators) {
            try {
              const element = await targetContext.$(loc);
              if (element) {
                const tagName = await element.evaluate(node => node.tagName.toLowerCase());
                const typeAttr = await element.getAttribute('type');
                
                if (tagName === 'input' && typeAttr === 'file') {
                  await element.setInputFiles(resolvedValue);
                  console.log(`   ✅ File injected directly into file input via locator: ${loc}`);
                  uploadedSuccessfully = true;
                  break;
                }
              }
            } catch {}
          }

          // 2. Fallback: File Chooser Event Interceptor for custom UI buttons
          if (!uploadedSuccessfully) {
            console.log(`   🔄 Custom upload button detected. Using File Chooser Event Interceptor...`);
            
            const workingLocator = await this.findWorkingElement(activePage, targetContext, component.locators);
            if (!workingLocator) {
              throw new Error(`File upload failed: Could not find working locator for component [${component.name}].`);
            }

            try {
              const fileChooserPromise = activePage.waitForEvent('filechooser', { timeout: 10000 });
              await targetContext.click(workingLocator);
              const fileChooser = await fileChooserPromise;
              await fileChooser.setFiles(resolvedValue);
              
              console.log(`   ✅ Successfully intercepted file dialog and injected file: ${resolvedValue}`);
              uploadedSuccessfully = true;
            } catch (chooserErr: any) {
              console.log(`   ⚠️ FileChooser interception failed: ${chooserErr.message}`);
              
              try {
                await targetContext.setInputFiles('input[type="file"]', resolvedValue);
                console.log(`   ✅ File injected using global 'input[type="file"]' fallback.`);
                uploadedSuccessfully = true;
              } catch (fallbackErr: any) {
                throw new Error(`File upload failed completely. Could neither find input[type="file"] nor intercept file chooser. Details: ${fallbackErr.message}`);
              }
            }
          }

          continue;
        }

        // --- CUSTOM WAIT LOOP / SYNCHRONIZATION NODE ---
        if (step.action === 'waitLoop') {
          let waitSeconds = 10;
          const userConfiguredSeconds = parseInt(resolvedValue, 10);
          if (!isNaN(userConfiguredSeconds) && userConfiguredSeconds > 0) {
            waitSeconds = userConfiguredSeconds;
          }

          console.log(`⏱️ [Wait Loop Node] Pausing execution for ${waitSeconds} second(s) to allow backend processing...`);
          await activePage.waitForTimeout(waitSeconds * 1000);

          console.log(`🔍 Checking if target component [${component.name}] is now visible...`);
          const workingLocator = await this.findWorkingElement(activePage, targetContext, component.locators);

          if (!workingLocator) {
            throw new Error(`Wait Loop Failed: Component [${component.name}] could not be found after waiting ${waitSeconds} seconds.`);
          }

          console.log(`   ✅ Target element found successfully using locator: ${workingLocator}`);
          continue;
        }

        // Standard execution for all other actions
        const workingLocator = await this.findWorkingElement(activePage, targetContext, component.locators);
        
        if (!workingLocator) {
          throw new Error(`Self-Healing Exhausted: All ${component.locators.length} fallback locator(s) failed for component [${component.name}].`);
        }

        // --- ENTERPRISE AUTO-SCROLL & HUMAN PACING ---
        try {
          // Smoothly scroll the element into the center of the viewport before acting on it
          const elementHandle = await targetContext.$(workingLocator);
          if (elementHandle) {
            await elementHandle.scrollIntoViewIfNeeded();
            // Optional tiny pause after scrolling to let sticky headers/animations settle
            await activePage.waitForTimeout(300);
          }
        } catch (scrollErr) {
          // Non-blocking fallback if scroll into view fails
        }

        switch (step.action) {
          case 'click':
            await targetContext.click(workingLocator);
            break;
          case 'dblclick':
            await targetContext.dblclick(workingLocator);
            break;
          case 'type':
            try {
              const tagName = await targetContext.$eval(workingLocator, el => el.tagName.toLowerCase()).catch(() => '');
              if (tagName === 'select') {
                console.log(`   dropdown detected (<select>). Selecting option: ${resolvedValue}`);
                await targetContext.selectOption(workingLocator, resolvedValue);
              } else {
                await targetContext.fill(workingLocator, resolvedValue);
              }
            } catch {
              await targetContext.fill(workingLocator, resolvedValue);
            }
            break;
          case 'select':
          case 'dropdown':
            console.log(`   [Dropdown Action] Selecting option: ${resolvedValue}`);
            await targetContext.selectOption(workingLocator, resolvedValue);
            break;
          case 'hover':
            await targetContext.hover(workingLocator);
            break;
          case 'press':
            await targetContext.press(workingLocator, resolvedValue || 'Enter');
            break;
          case 'waitForSelector':
            await targetContext.waitForSelector(workingLocator);
            break;
          case 'scroll':
            await activePage.mouse.wheel(0, 400);
            break;
          default:
            console.warn(`⚠️ Unhandled action type: ${step.action}`);
        }
      }

      console.log(`\n✅ Enterprise Workflow executed successfully!`);
    } catch (error: any) {
      executionFailed = true;
      console.error(`\n❌ Execution Failed:`, error.message);
      
      try {
        await activePage.screenshot({ path: `failure_${Date.now()}.png`, fullPage: true });
        console.log(`📸 Failure screenshot saved to disk.`);
      } catch {}

      console.log(`\n🛑 [DEBUG MODE] Browser window will remain open for inspection.`);
      await new Promise(() => {});
    } finally {
      if (!executionFailed) {
        await browser.close();
      }
    }
  }
}