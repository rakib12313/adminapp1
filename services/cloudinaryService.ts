
const CLOUD_NAME = "dpe74ejhl";
const UPLOAD_PRESET = "student_lms";

export const uploadToCloudinary = async (file: File): Promise<string> => {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary configuration missing. Please check CLOUD_NAME and UPLOAD_PRESET in services/cloudinaryService.ts");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  
  // Detect resource type roughly
  const resourceType = file.type.includes('pdf') ? 'auto' : 'image';

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errBody = await response.json();
      console.error("Cloudinary Error Details:", errBody);
      throw new Error(errBody.error?.message || "Upload failed");
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};
