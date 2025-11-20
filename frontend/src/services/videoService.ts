/**
 * Video Generation Service
 * Uses Replicate API with free models to generate cinematic park videos
 */

// IMPORTANT: Add your Replicate API key here. You can get one for free from the Replicate website.
const REPLICATE_API_KEY = "";

// Using a CORS proxy to bypass browser restrictions on calling the Replicate API directly.
// This is necessary for client-side applications without a dedicated backend.
const CORS_PROXY = "https://corsproxy.io/?";
const REPLICATE_API_BASE_URL = "https://api.replicate.com/v1/predictions";


export interface VideoGenerationOptions {
  designImageUrl: string; // base64 or image URL
  parkName: string;
  timeOfDay: "day" | "night" | "day-to-night";
  activities: string[]; // e.g. ['walking', 'dogs', 'cycling']
  duration?: number; // seconds
}

export interface VideoGenerationProgress {
  status: "starting" | "processing" | "completed" | "failed";
  message: string;
  progress: number; // 0–100
  videoUrl?: string;
  error?: string;
}

/**
 * Generate a cinematic AI video using Replicate’s free Zeroscope model
 */
export const generateParkVideo = async (
  options: VideoGenerationOptions,
  onProgress: (progress: VideoGenerationProgress) => void
): Promise<string> => {
  if (!REPLICATE_API_KEY) {
    throw new Error(
      "Missing Replicate API key. Please add your key to services/videoService.ts."
    );
  }

  onProgress({
    status: "starting",
    message: "Initializing video generation...",
    progress: 0,
  });

  const prompt = buildVideoPrompt(options);

  try {
    // 🧠 Step 1: Start video generation with minimax/video-01
    const predictionResponse = await fetch(`${CORS_PROXY}${REPLICATE_API_BASE_URL}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version:
          "b7149d5b356269665a6e5a6a575e9b819ac40a61250393080b06b72d2f70b7e4", // ✅ Updated to correct version hash for minimax/video-01
        input: {
          prompt,
          num_frames: options.duration ? options.duration * 8 : 40,
          num_inference_steps: 25,
          guidance_scale: 9,
          height: 320,
          width: 576,
        },
      }),
    });

    if (!predictionResponse.ok) {
      const errorBody = await predictionResponse.json();
      throw new Error(`Failed to start generation: ${errorBody.detail || predictionResponse.statusText}`);
    }

    const prediction = await predictionResponse.json();
    const predictionId = prediction.id;

    onProgress({
      status: "processing",
      message: "Video generation in progress...",
      progress: 20,
    });

    // 🧠 Step 2: Poll Replicate until complete
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 5000));

      const statusRes = await fetch(`${CORS_PROXY}${REPLICATE_API_BASE_URL}/${predictionId}`, {
        headers: { Authorization: `Token ${REPLICATE_API_KEY}` },
      });

      if (!statusRes.ok) throw new Error("Failed to check Replicate status");

      const status = await statusRes.json();

      if (status.status === "succeeded") {
        const outputUrl =
          Array.isArray(status.output) && status.output.length > 0
            ? status.output[0]
            : status.output;
        onProgress({
          status: "completed",
          message: "✅ Video generated successfully!",
          progress: 100,
          videoUrl: outputUrl,
        });
        return outputUrl;
      }

      if (status.status === "failed") {
        throw new Error(status.error || "Video generation failed");
      }

      const progressPercent = Math.min(20 + (attempts / maxAttempts) * 70, 90);
      onProgress({
        status: "processing",
        message: `Generating video... (${Math.round(progressPercent)}%)`,
        progress: progressPercent,
      });

      attempts++;
    }

    throw new Error("Video generation timed out after 5 minutes.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error occurred.";
    onProgress({
      status: "failed",
      message: msg,
      progress: 0,
      error: msg,
    });
    throw error;
  }
};

/**
 * Builds a cinematic natural-language video prompt
 */
const buildVideoPrompt = (options: VideoGenerationOptions): string => {
  const { parkName, timeOfDay, activities } = options;

  const activityDescriptions: Record<string, string> = {
    walking: "people walking",
    playing: "children playing",
    dogs: "dogs running",
    cycling: "people cycling",
    sitting: "people relaxing on benches",
    jogging: "joggers on trails",
    picnic: "families having picnics",
    sports: "people playing sports",
  };

  const lightingConditions: Record<string, string> = {
    day: "during a bright, sunny day",
    night: "at night, with warm streetlights illuminating the scene",
    "day-to-night": "at sunset, with golden hour light transitioning to evening",
  };

  const activitiesText = activities
    .map((a) => activityDescriptions[a] || a)
    .join(", ");

  const lighting = lightingConditions[timeOfDay] || lightingConditions.day;

  // Create a more direct, descriptive prompt for the new model
  return `A cinematic video of "${parkName}", a beautiful modern park. The scene shows ${activitiesText}, set ${lighting}. Photorealistic, 4K, aerial drone shot.`.trim();
};

/**
 * 🌀 Animate a static design render (image → motion)
 * Uses Stability AI's Stable Video Diffusion (image-to-video)
 */
export const animateDesignImage = async (
  imageUrl: string,
  onProgress: (progress: VideoGenerationProgress) => void
): Promise<string> => {
  if (!REPLICATE_API_KEY)
    throw new Error("Missing Replicate API key. Please add your key to services/videoService.ts.");

  onProgress({
    status: "starting",
    message: "Animating design image...",
    progress: 0,
  });

  try {
    const res = await fetch(`${CORS_PROXY}${REPLICATE_API_BASE_URL}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version:
          "fcfcb3a92b70dfb7e78a11ccce99a83383a8a54d482a3c6579ff4a21d7764cc3", // ✅ Stable Video Diffusion model ID
        input: {
          image: imageUrl,
          motion_bucket_id: 127,
          cond_aug: 0.02,
          num_frames: 25,
        },
      }),
    });

    if (!res.ok) throw new Error("Failed to start animation.");

    const prediction = await res.json();
    const id = prediction.id;

    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 5000));
      const poll = await fetch(`${CORS_PROXY}${REPLICATE_API_BASE_URL}/${id}`, {
        headers: { Authorization: `Token ${REPLICATE_API_KEY}` },
      });

      const status = await poll.json();

      if (status.status === "succeeded") {
        const outputUrl =
          Array.isArray(status.output) && status.output.length > 0
            ? status.output[0]
            : status.output;
        onProgress({
          status: "completed",
          message: "Animation completed!",
          progress: 100,
          videoUrl: outputUrl,
        });
        return outputUrl;
      }

      if (status.status === "failed") throw new Error(status.error || "Animation failed");

      const progressPercent = Math.min(20 + (attempts / maxAttempts) * 70, 90);
      onProgress({
        status: "processing",
        message: `Animating image... (${Math.round(progressPercent)}%)`,
        progress: progressPercent,
      });

      attempts++;
    }

    throw new Error("Animation timed out.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error.";
    onProgress({
      status: "failed",
      message: msg,
      progress: 0,
      error: msg,
    });
    throw err;
  }
};