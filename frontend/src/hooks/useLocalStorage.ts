import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function getStorageValue<T>(key: string, defaultValue: T): T {
  // getting stored value
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      try {
        return JSON.parse(saved) as T;
      } catch (e) {
        console.error("Failed to parse JSON from localStorage", e);
        return defaultValue;
      }
    }
  }
  return defaultValue;
}

export function useLocalStorage<T>(key: string | null, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    console.log("Initializing useLocalStorage for key:", key);
    if (!key) {
      console.log("No key provided, using default value");
      return defaultValue;
    }
    const storedValue = getStorageValue(key, defaultValue);
    console.log("Retrieved stored value:", storedValue);
    return storedValue;
  });

  useEffect(() => {
    // This effect runs when the key changes (e.g., user logs in/out)
    // to load the correct data or reset to default.
    if (!key) {
      setValue(defaultValue);
    } else {
      setValue(getStorageValue(key, defaultValue));
    }
  // We only want this to run when the key changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!key) {
        console.log("No key provided, skipping storage effect");
        return;
    }

    try {
        console.log("Attempting to save value for key:", key);
        if (value === null || value === undefined) {
            console.log("Removing item from localStorage:", key);
            localStorage.removeItem(key);
        } else {
            console.log("Saving value to localStorage:", { key, value });
            // Attempt to save the full value
            localStorage.setItem(key, JSON.stringify(value));
        }
    } catch (e: any) {
        if (!(e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22))) {
            console.error("Failed to set item in localStorage:", e);
            return;
        }

        console.warn("Project data is too large for localStorage. Attempting tiered reduction to save essential data.");
        
        const dataToSave = JSON.parse(JSON.stringify(value));
        let saved = false;

        // --- Reduction Strategy 0: Remove large OSM/map data that can be re-fetched ---
        const removeLargeMapData = (obj: any) => {
            // Remove cached OSM building data
            if (obj && obj.osmBuildings) {
                delete obj.osmBuildings;
            }
            // Remove pedestrian spaces cache
            if (obj && obj.pedestrianSpaces) {
                delete obj.pedestrianSpaces;
            }
            // Remove large map overlays
            if (obj && obj.mapOverlays) {
                delete obj.mapOverlays;
            }
            // Limit chat history to last 10 messages (chat can become huge)
            if (obj && obj.chatHistory && Array.isArray(obj.chatHistory) && obj.chatHistory.length > 10) {
                obj.chatHistory = obj.chatHistory.slice(-10);
            }
            // Remove base64 screenshots (can be regenerated)
            if (obj && obj.siteScreenshotBase64) {
                delete obj.siteScreenshotBase64;
            }
            // Clean alternatives
            if (obj && obj.alternatives && Array.isArray(obj.alternatives)) {
                obj.alternatives.forEach((alt: any) => {
                    if (alt.osmBuildings) delete alt.osmBuildings;
                    if (alt.pedestrianSpaces) delete alt.pedestrianSpaces;
                    if (alt.mapOverlays) delete alt.mapOverlays;
                    // Limit chat history in alternatives
                    if (alt.chatHistory && Array.isArray(alt.chatHistory) && alt.chatHistory.length > 10) {
                        alt.chatHistory = alt.chatHistory.slice(-10);
                    }
                    if (alt.siteScreenshotBase64) delete alt.siteScreenshotBase64;
                });
            }
        };

        removeLargeMapData(dataToSave);
        
        try {
            localStorage.setItem(key, JSON.stringify(dataToSave));
            console.log("Successfully saved by removing large map data (OSM buildings, pedestrian spaces, old chat).");
            saved = true;
        } catch (e1) {
            // Continue to next reduction strategy
            console.warn("Still too large after removing map data, trying more aggressive reduction...");
        }

        // --- Reduction Strategy 1: Remove all urban context images ---
        let wasReduced = false;
        if (!saved) {
            const reduceUrbanImages = (obj: any) => {
                if (obj && obj.analysisResult && Array.isArray(obj.analysisResult)) {
                    obj.analysisResult.forEach((section: any) => {
                        if (section.imageUrls && section.imageUrls.urban) {
                            section.imageUrls.urban = null;
                            wasReduced = true;
                        }
                    });
                }
                if (obj && obj.alternatives && Array.isArray(obj.alternatives)) {
                    obj.alternatives.forEach((alt: any) => reduceUrbanImages(alt));
                }
            };

            reduceUrbanImages(dataToSave);

            if (wasReduced) {
                try {
                    localStorage.setItem(key, JSON.stringify(dataToSave));
                    console.log("Successfully saved a reduced version by removing urban context images.");
                    saved = true;
                } catch (e2) { /* Quota error, continue to next strategy */ }
            }
        }

        // --- Reduction Strategy 2: Remove site images from inactive alternatives ---
        if (!saved) {
            let wasFurtherReduced = false;
            if (dataToSave.alternatives && Array.isArray(dataToSave.alternatives)) {
                dataToSave.alternatives.forEach((alt: any) => {
                    // Only reduce if it's NOT the currently viewed alternative
                    if (alt.id !== dataToSave.currentAlternativeId) {
                        if (alt.analysisResult && Array.isArray(alt.analysisResult)) {
                            alt.analysisResult.forEach((section: any) => {
                                if (section.imageUrls && section.imageUrls.site) {
                                    section.imageUrls.site = null;
                                    wasFurtherReduced = true;
                                }
                            });
                        }
                    }
                });
            }

            if(wasFurtherReduced) {
              try {
                localStorage.setItem(key, JSON.stringify(dataToSave));
                console.log("Successfully saved a more reduced version by removing site images from non-active alternatives.");
                saved = true;
              } catch (e3) { /* Quota error, continue */ }
            }
        }

        // --- Reduction Strategy 3: Keep ONLY the current alternative ---
        if (!saved) {
            if (dataToSave.alternatives && Array.isArray(dataToSave.alternatives) && dataToSave.currentAlternativeId) {
                const currentAlt = dataToSave.alternatives.find((a: any) => a.id === dataToSave.currentAlternativeId);
                if (currentAlt) {
                    dataToSave.alternatives = [currentAlt];
                    console.log("Reduced to only current alternative to save space");
                    
                    try {
                        localStorage.setItem(key, JSON.stringify(dataToSave));
                        console.log("Successfully saved by keeping only current alternative.");
                        saved = true;
                    } catch (e4) { /* Quota error, continue */ }
                }
            }
        }

        // --- Reduction Strategy 4: Nuclear option - save only essential metadata ---
        if (!saved) {
            console.warn("Applying nuclear option: saving only essential project metadata");
            const essentialData = {
                id: dataToSave.id,
                name: dataToSave.name,
                location: dataToSave.location,
                lastSaved: new Date().toISOString(),
                // Keep only titles, no content
                analysisResult: (dataToSave.analysisResult || []).map((section: any) => ({
                    title: section.title,
                    content: section.content?.substring(0, 200) + '...',
                    imageUrls: { urban: null, site: null, street: null }
                })),
                quantitativeData: null,
                chatHistory: [],
                alternatives: [],
                conceptualPlan: dataToSave.conceptualPlan || null,
            };
            
            try {
                localStorage.setItem(key, JSON.stringify(essentialData));
                console.log("Successfully saved essential metadata only. Full data lost but project preserved.");
                saved = true;
            } catch (e5) { /* Even this failed */ }
        }

        if (!saved) {
            console.error("Failed to save even essential metadata. Data is too large.");
            alert("Your project data is too large to save. Please:\n\n1. Download your report NOW to preserve your work\n2. Close and reopen this page\n3. Work with smaller analysis areas (reduce radius)\n4. Avoid creating too many design alternatives");
        }
    }
  }, [key, value]);

  return [value, setValue];
}