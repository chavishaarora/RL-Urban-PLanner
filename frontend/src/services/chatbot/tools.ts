// Navigation helpers - the chatbot guides users through the app
// by opening relevant pages/views rather than executing tasks

export type NavigationResult = { ok: true; message?: string } | { ok: false; error: string };

// Navigate to the analysis view (where user can draw boundary and run analysis)
export async function navigateToAnalysis(): Promise<NavigationResult> {
  try {
    window.dispatchEvent(new CustomEvent('ue-navigate', { detail: { view: 'analysis' } }));
    return { ok: true, message: 'Opening analysis view...' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to navigate' };
  }
}

// Navigate to context maps view
export async function navigateToContextMaps(): Promise<NavigationResult> {
  try {
    window.dispatchEvent(new CustomEvent('ue-navigate', { detail: { view: 'contextMaps' } }));
    return { ok: true, message: 'Opening context maps...' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to navigate' };
  }
}

// Navigate to concept planner
export async function navigateToConceptPlanner(): Promise<NavigationResult> {
  try {
    window.dispatchEvent(new CustomEvent('ue-navigate', { detail: { view: 'planner' } }));
    return { ok: true, message: 'Opening concept planner...' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to navigate' };
  }
}

// Navigate to quantitative analysis (metrics/KPIs)
export async function navigateToQuantitativeAnalysis(): Promise<NavigationResult> {
  try {
    window.dispatchEvent(new CustomEvent('ue-navigate', { detail: { view: 'quantitative' } }));
    return { ok: true, message: 'Opening quantitative metrics...' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to navigate' };
  }
}

// Scroll to or highlight a specific section on current page
export async function scrollToSection(sectionId: string): Promise<NavigationResult> {
  try {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return { ok: true, message: `Scrolling to ${sectionId}...` };
    }
    return { ok: false, error: 'Section not found' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to scroll' };
  }
}

