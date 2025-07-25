# PixelPilot - BackstopJS Workflow Guide

## Visual Regression Testing Workflow

### 🎯 **Complete BackstopJS Process**

```
1. 📝 Configure Scenarios
   └─ Define URLs, selectors, viewports, and scripts

2. 📸 Generate Reference Screenshots
   └─ Create baseline images for comparison

3. 🔄 Run Visual Regression Tests  
   └─ Compare current state with references

4. ✅ Approve Changes (when intentional)
   └─ Promote test images as new references

5. 📊 Review Reports
   └─ Analyze differences and results
```

---

## 🚀 **Available Actions**

### **Generate Reference Screenshots**
- **Purpose**: Create baseline images for comparison
- **When to use**: First time setup or major design changes
- **Command**: `POST /api/reference`

### **Run Visual Regression Test** 
- **Purpose**: Compare current state with reference images
- **When to use**: Regular testing to detect changes
- **Command**: `POST /api/test`

### **Approve Test Results** ✨ *NEW*
- **Purpose**: Accept current test images as new references
- **When to use**: When visual changes are intentional
- **Command**: `POST /api/approve`

### **Sync Uploaded References**
- **Purpose**: Sync manually uploaded reference images
- **When to use**: When you have reference images from other sources
- **Command**: `POST /api/sync-references`

---

## 📋 **Typical Workflows**

### **Initial Setup**
1. Configure scenarios and viewports
2. Generate Reference Screenshots
3. Run tests to verify everything works

### **Regular Testing** 
1. Run Visual Regression Test
2. Review report for differences
3. If differences are bugs → Fix code and retest
4. If differences are intentional → Approve Test Results

### **Design Updates**
1. Make design changes
2. Run Visual Regression Test (will show differences)
3. Review changes in HTML report
4. **Approve Test Results** to accept new design as baseline
5. Future tests will use the new approved images as references

---

## 💡 **When to Use Approve**

✅ **Use Approve When:**
- Design updates are intentional
- UI components have been redesigned 
- Layout changes are approved
- New features change the visual appearance
- Color scheme or branding updates

❌ **Don't Use Approve When:**
- You see unexpected differences
- Visual bugs are detected
- Changes are not intentional
- You're not sure what caused the differences

---

## 🎨 **BackstopJS Script Execution Order**

```
START
  │
  ├─► Load Scenario Config
  │     (url, selectors, scripts, etc.)
  │
  ├─► Apply onBeforeScript 🟡
  │     ❗ Happens BEFORE the page loads
  │     ✅ Good for: sessionStorage, localStorage
  │
  ├─► Load URL (navigate to scenario.url)
  │
  ├─► Wait (optional)
  │     └─ scenario.delay (e.g., 1000 ms)
  │
  ├─► Apply hideSelectors
  │     └─ Applies visibility: hidden
  │
  ├─► Apply removeSelectors  
  │     └─ Completely removes from DOM
  │
  ├─► Apply onReadyScript 🟢
  │     ❗ Happens AFTER page loads
  │     ✅ Good for: removing popups, clicking buttons, modifying DOM
  │
  ├─► Capture Screenshot 📸
  │
  ├─► Compare with reference image
  │
  └─► DONE
```

---

## 🔧 **Advanced Features**

### **Scenario Filtering**
- Run tests on specific scenarios only
- Use scenario selection in the UI
- Pass `filter` parameter to API endpoints

### **Custom Scripts**
- **onBeforeScript**: Execute before page load
- **onReadyScript**: Execute after page load
- **customScript**: Additional JavaScript execution

### **Element Control**
- **hideSelectors**: Hide elements during screenshot
- **removeSelectors**: Remove elements from DOM
- **clickSelector**: Click elements before screenshot

---

## 📊 **Understanding Results**

### **Test Outcomes**
- ✅ **Passed**: No visual differences detected
- ❌ **Failed**: Visual differences found
- ⚠️ **Error**: Technical issues (network, selector missing, etc.)

### **Report Features**
- **Side-by-side comparison**: Reference vs Test images
- **Diff highlighting**: Red overlay showing changes
- **Similarity percentage**: Quantified difference metrics
- **Interactive report**: Click to explore differences

---

## 🎯 **Best Practices**

1. **Start Small**: Test individual components before full pages
2. **Use Stable Selectors**: Avoid selectors that change frequently  
3. **Hide Dynamic Content**: Use hideSelectors for timestamps, ads, etc.
4. **Regular Testing**: Run tests frequently to catch issues early
5. **Review Before Approving**: Always check the HTML report before approving changes
6. **Document Changes**: Add commit messages when approving new references

---

*Happy Visual Testing with PixelPilot! 🚀*
