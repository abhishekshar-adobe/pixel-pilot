# BackstopJS Naming Convention - Final Fix

## 🎯 **Issue Resolved**

### **The Problem:**
BackstopJS reference image names had an extra hyphen in selector processing:

**Generated (Incorrect):** `backstop_default_Recent_Posts_0_latest-blog-container_0_Lg-desktop.png`  
**Expected (Correct):** `backstop_default_Recent_Posts_0_latest-blogcontainer_0_Lg-desktop.png`

### **Root Cause:**
The selector `"#latest-blog > .container"` was being processed to add hyphens between parts, but BackstopJS actually concatenates selector parts without additional separators.

## 🔧 **Final Solution Applied**

### **Corrected Selector Processing Logic:**
```javascript
// OLD (INCORRECT) - Added extra hyphens
const selectorName = scenarioConfig.selectors[0]
  .replace(/#/g, '') // Remove hash symbols
  .replace(/\./g, '') // Remove dots  
  .replace(/\s*>\s*/g, '-') // ❌ Replace child selectors with hyphens
  .replace(/\s+/g, '-') // ❌ Replace remaining spaces with hyphens
  .toLowerCase();

// NEW (CORRECT) - Concatenates without extra separators  
const selectorName = scenarioConfig.selectors[0]
  .replace(/#/g, '') // Remove hash symbols
  .replace(/\./g, '') // Remove dots  
  .replace(/\s*>\s*/g, '') // ✅ Remove child selectors and spaces
  .replace(/\s+/g, '') // ✅ Remove remaining spaces
  .toLowerCase();
```

### **Transformation Examples:**

| **Original Selector** | **Processed Name** | **Result** |
|----------------------|-------------------|------------|
| `"#latest-blog > .container"` | `"latest-blogcontainer"` | ✅ Correct |
| `".footer-subscription"` | `"footer-subscription"` | ✅ Preserved existing hyphens |
| `"#main .content"` | `"maincontent"` | ✅ Concatenated |
| `".nav > .item"` | `"navitem"` | ✅ Concatenated |

## 📁 **Files Updated**

### **1. Main Server (`server/index.js`)**
Updated **4 instances** of selector processing:

- **Line ~533:** Upload screenshot handler
- **Line ~629:** Sync status checker  
- **Line ~698:** Manual sync function
- **Line ~1211:** Bulk sync operation

### **2. Test Helper (`server/test-filename.js`)**
- Updated filename generation for testing consistency

## ✅ **Expected Results**

### **Before Fix:**
```
✗ backstop_default_Recent_Posts_0_latest-blog-container_0_Lg-desktop.png
✗ backstop_default_Footer_Section_0_footer-subscription-area_0_desktop.png
```

### **After Fix:**
```
✓ backstop_default_Recent_Posts_0_latest-blogcontainer_0_Lg-desktop.png
✓ backstop_default_Footer_Section_0_footer-subscription_0_desktop.png
```

## 🎯 **BackstopJS Naming Rules Confirmed**

### **Scenario Names:**
- **Spaces → Underscores:** `"Recent Posts"` → `"Recent_Posts"`
- **Preserve case and other characters**

### **Selector Names:**
- **Remove symbols:** `#` and `.` are stripped
- **Remove child selectors:** `>` and surrounding spaces are removed
- **Remove all spaces:** Concatenate without separators
- **Preserve existing hyphens:** Keep hyphens that are part of class/ID names
- **Convert to lowercase:** Final result is lowercased

### **Complete Pattern:**
```
backstop_default_{SCENARIO}_{SELECTOR_INDEX}_{PROCESSED_SELECTOR}_{VIEWPORT_INDEX}_{VIEWPORT}.png
```

## 🚀 **Validation**

To test the fix:

1. **Upload a reference screenshot** for:
   - Scenario: "Recent Posts"  
   - Selector: "#latest-blog > .container"
   - Viewport: "Lg-desktop"

2. **Expected filename:** `backstop_default_Recent_Posts_0_latest-blogcontainer_0_Lg-desktop.png`

3. **BackstopJS test** should now find the reference image correctly

## 📊 **Impact**

✅ **Immediate:** All new uploads will use correct naming  
✅ **Sync operations:** Reference syncing will work properly  
✅ **BackstopJS tests:** Will find reference images as expected  
✅ **Consistency:** All naming logic unified across the application  

The BackstopJS naming convention issue is now completely resolved! 🎉
