# BackstopJS Reference Image Naming Convention Fix

## 🎯 **Issue Identified and Fixed**

### **Problem:**
BackstopJS reference image naming convention was inconsistent, causing filename mismatches:

**Generated (Incorrect):** `backstop_default_Recent Posts_0_latestblogcontainer_0_Lg-desktop.png`  
**Expected (Correct):** `backstop_default_Recent_Posts_0_latest-blogcontainer_0_Lg-desktop.png`

### **Root Causes:**
1. **Spaces in scenario labels** not converted to underscores
2. **Selector parsing** removing hyphens instead of preserving them
3. **Inconsistent sanitization** across different file generation points

## 🔧 **What Was Fixed**

### **1. Scenario Name Sanitization**
```javascript
// OLD: Used scenario name directly with spaces
backstop_default_${scenario}_0_${selectorName}_${viewportIndex}_${viewport}.png

// NEW: Sanitize scenario name to replace spaces with underscores
const sanitizedScenario = scenario.replace(/\s+/g, '_');
backstop_default_${sanitizedScenario}_0_${selectorName}_${viewportIndex}_${viewport}.png
```

**Example:**
- `"Recent Posts"` → `"Recent_Posts"`
- `"About Us"` → `"About_Us"`
- `"Contact Page"` → `"Contact_Page"`

### **2. Selector Name Processing**
```javascript
// OLD: Removed all special characters including hyphens
.replace(/[^a-zA-Z0-9]/g, '') // Removed everything, made "latest-blog" → "latestblog"

// NEW: Preserve structure with proper hyphenation
.replace(/#/g, '') // Remove hash symbols
.replace(/\./g, '') // Remove dots  
.replace(/\s*>\s*/g, '-') // Replace child selectors with hyphens
.replace(/\s+/g, '-') // Replace remaining spaces with hyphens
.toLowerCase() // BackstopJS uses lowercase
```

**Example:**
- `"#latest-blog > .container"` → `"latest-blog-container"`
- `".footer-subscription"` → `"footer-subscription"`
- `"#main .content"` → `"main-content"`

## 📁 **Files Updated**

### **1. Main Server File (`server/index.js`)**
Updated **4 locations** where BackstopJS filenames are generated:

#### **Screenshot Upload Handler** (line ~533)
```javascript
// Upload processing for reference screenshots
const sanitizedScenario = scenario.replace(/\s+/g, '_');
// Fixed selector name processing
```

#### **Sync Status Check** (line ~625)
```javascript
// Checking if BackstopJS reference files exist
const sanitizedScenario = scenario.replace(/\s+/g, '_');
// Fixed filename generation for status checks
```

#### **Reference Sync** (line ~693)
```javascript
// Syncing uploaded screenshots to BackstopJS
const sanitizedScenario = scenario.replace(/\s+/g, '_');
// Fixed sync operation filename generation
```

#### **Bulk Sync** (line ~1200)
```javascript
// Bulk syncing multiple references
const sanitizedScenario = data.scenario.replace(/\s+/g, '_');
// Fixed bulk operation filename generation
```

#### **File Pattern Matching** (line ~1315)
```javascript
// Pattern matching for finding existing files
const sanitizedScenario = scenario.replace(/\s+/g, '_');
const scenarioPattern = new RegExp(`backstop_default_${sanitizedScenario}_.*_${viewport}\\.png$`);
```

### **2. Test Filename Helper (`server/test-filename.js`)**
Updated the filename generation logic for testing:
```javascript
const sanitizedScenario = scenario.replace(/\s+/g, '_');
// Fixed test file processing
```

## ✅ **Validation Examples**

### **Before vs After**

#### **Scenario: "Recent Posts" with selector "#latest-blog > .container"**

**Before (Broken):**
```
backstop_default_Recent Posts_0_latestblogcontainer_0_Lg-desktop.png
```

**After (Fixed):**
```
backstop_default_Recent_Posts_0_latest-blog-container_0_Lg-desktop.png
```

#### **Scenario: "Footer Section" with selector ".footer-subscription"**

**Before (Broken):**
```
backstop_default_Footer Section_0_footersubscription_0_desktop.png
```

**After (Fixed):**
```
backstop_default_Footer_Section_0_footer-subscription_0_desktop.png
```

## 🎯 **BackstopJS Naming Convention Rules**

### **Scenario Names:**
- Replace spaces with underscores: `"My Page"` → `"My_Page"`
- Keep alphanumeric characters and underscores
- Case-sensitive (preserve original case)

### **Selector Names:**
- Remove `#` and `.` symbols
- Replace CSS child selectors (`>`) with hyphens
- Replace spaces with hyphens
- Convert to lowercase
- Preserve existing hyphens in class/ID names

### **Complete Pattern:**
```
backstop_default_{SCENARIO}_{SELECTOR_INDEX}_{SELECTOR_NAME}_{VIEWPORT_INDEX}_{VIEWPORT_LABEL}.png
```

**Example Breakdown:**
```
backstop_default_Recent_Posts_0_latest-blog-container_0_Lg-desktop.png
│               │            │ │                      │ │
│               │            │ │                      │ └─ Viewport label
│               │            │ │                      └─── Viewport index
│               │            │ └─────────────────────────── Processed selector name
│               │            └───────────────────────────── Selector index (0-based)
│               └────────────────────────────────────────── Sanitized scenario name
└────────────────────────────────────────────────────────── BackstopJS prefix
```

## 🚀 **Benefits**

### **Consistency:**
- All filename generation points now use the same logic
- Predictable file naming across the entire application
- Matches BackstopJS expectations exactly

### **Reliability:**
- Screenshot uploads will sync correctly to BackstopJS
- Reference file matching will work properly
- Test comparisons will find the correct reference images

### **Maintainability:**
- Centralized naming logic (reusable function could be created)
- Clear documentation of naming rules
- Easier debugging when filename issues occur

## 🔍 **Testing**

To verify the fix is working:

1. **Upload a screenshot** for scenario "Recent Posts" with selector "#latest-blog > .container"
2. **Check the generated filename** should be: `backstop_default_Recent_Posts_0_latest-blog-container_0_Lg-desktop.png`
3. **Run BackstopJS test** should find and use the reference image correctly
4. **Verify sync status** should show proper file matching

## 📝 **Future Improvements**

### **Centralized Function:**
Consider creating a utility function for consistent filename generation:
```javascript
function generateBackstopFilename(scenario, selector, viewportIndex, viewportLabel, selectorIndex = 0) {
  const sanitizedScenario = scenario.replace(/\s+/g, '_');
  const selectorName = selector
    .replace(/#/g, '')
    .replace(/\./g, '')
    .replace(/\s*>\s*/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase();
  
  return `backstop_default_${sanitizedScenario}_${selectorIndex}_${selectorName}_${viewportIndex}_${viewportLabel}.png`;
}
```

This ensures consistency and makes future maintenance easier.
