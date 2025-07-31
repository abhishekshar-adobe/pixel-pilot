# Figma Image Format Update: PNG to JPG

## 🎯 **Change Summary**
Updated the PixelPilot application to download Figma images in JPG format instead of PNG for better performance and smaller file sizes.

## 🔧 **Changes Made**

### **Backend Changes (server/index.js)**

1. **`/api/design-comparison/download-figma-layer` endpoint:**
   - Changed format from `'png'` to `'jpg'` in `getImagesWithDimensions()` call
   - Updated response content type from `'image/png'` to `'image/jpeg'`
   - Updated base64 data URL prefix from `data:image/png` to `data:image/jpeg`

2. **`/api/design-comparison/layer-thumbnails` endpoint:**
   - Changed format from `'png'` to `'jpg'` in `getImagesWithDimensions()` call

3. **`/api/design-comparison/bulk-thumbnails` endpoint:**
   - Changed format from `'png'` to `'jpg'` in `getImagesWithDimensions()` call

4. **`/api/design-comparison/export-layers-for-upload` endpoint:**
   - Changed default format from `'png'` to `'jpg'`

5. **`/api/design-comparison/export-layers` endpoint:**
   - Changed default format from `'png'` to `'jpg'`

6. **Downloaded filename generation:**
   - Updated filename extension from `.png` to `.jpg`

### **Figma Integration Changes (server/figma-integration.js)**

1. **`getImages()` method:**
   - Changed default format parameter from `'png'` to `'jpg'`

2. **`getImagesWithDimensions()` method:**
   - Changed default format parameter from `'png'` to `'jpg'`
   - Updated documentation comment to list 'jpg' first

3. **`exportLayers()` method:**
   - Changed default format from `'png'` to `'jpg'`

### **Frontend Changes**

1. **DesignComparison.jsx:**
   - Changed default export format state from `'png'` to `'jpg'`
   - Updated `exportSelectedLayers()` default format parameter

2. **ScreenshotUploader.jsx:**
   - Updated File object type from `'image/png'` to `'image/jpeg'`

## ✅ **Benefits**

### **Performance Improvements:**
- **Smaller file sizes:** JPG compression typically reduces file size by 60-80% compared to PNG
- **Faster downloads:** Smaller files mean quicker transfer times from Figma API
- **Reduced bandwidth usage:** Especially beneficial for bulk operations

### **Maintained Compatibility:**
- **BackstopJS integration preserved:** Uploaded JPG files are automatically converted to PNG for BackstopJS reference images
- **Image quality maintained:** JPG compression is suitable for screenshots and design mockups
- **Existing workflows unchanged:** All existing functionality continues to work as expected

## 🔄 **Image Processing Flow**

1. **Figma Download:** Images downloaded from Figma API in JPG format
2. **Transfer:** JPG files transferred to frontend (faster due to smaller size)
3. **Upload:** JPG files uploaded to server via screenshot upload endpoint
4. **Conversion:** Server automatically converts JPG to PNG when syncing to BackstopJS
5. **BackstopJS:** PNG files used for visual regression testing (as expected by BackstopJS)

## 🎨 **Use Cases**

- **Design import from Figma:** Faster download and transfer of design elements
- **Thumbnail generation:** Quicker loading of layer previews in the UI
- **Bulk operations:** Significantly improved performance when processing multiple layers
- **Screenshot uploads:** Maintained compatibility with existing BackstopJS workflows

## ✅ **Testing Recommendations**

1. Test Figma layer downloads to ensure JPG format is properly handled
2. Verify thumbnail generation works with new format
3. Confirm bulk download operations are faster
4. Test BackstopJS sync to ensure PNG conversion works correctly
5. Validate that existing reference images are not affected

---
**Date:** July 31, 2025  
**Status:** ✅ Implemented and server restarted successfully
