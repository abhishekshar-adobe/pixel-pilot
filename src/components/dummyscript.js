// Dummy Data Script for BackstopJS
// This script should be used WITHOUT the module.exports wrapper
// The backend will add the wrapper automatically via processCustomScript

console.log('🟢 START: Backstop ready script');

// Wait for network idle
try {
  await page.waitForNetworkIdle({ idleTime: 1000, timeout: 15000 });
} catch (e) {
  console.log("⚠ Network idle timeout - continuing");
}

// Scroll the entire page (returns a Promise)
await page.evaluate(() => {
  return new Promise(resolve => {
    let total = 0;
    let distance = 400;

    const timer = setInterval(() => {
      window.scrollBy(0, distance);
      total += distance;

      if (total >= document.body.scrollHeight) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
});

// Freeze all CSS animations/transitions
await page.addStyleTag({
  content: `
    * {
      animation: none !important;
      transition: none !important;
    }
  `
});

// DOM Manipulation
await page.evaluate(() => {
  const VALID_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
  // Blue background with "Pixel Pilot" text as SVG data URI (instant load!)
  const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%234A90E2'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial, sans-serif' font-size='32' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='middle'%3EPixel Pilot%3C/text%3E%3C/svg%3E";

  const isValidImgURL = (url) => {
    if (!url) return false;
    // Skip data URIs (inline images like data:image/svg+xml,...)
    if (url.startsWith('data:')) return false;
    // Skip blob URLs (generated inline content)
    if (url.startsWith('blob:')) return false;
    let lower = url.split("?")[0].toLowerCase();
    return VALID_EXT.some(ext => lower.endsWith(ext));
  };

  // Replace IMGs (skip inline SVGs and data URIs)
  document.querySelectorAll("img").forEach(img => {
    if (img.src && isValidImgURL(img.src)) img.src = PLACEHOLDER;
  });

  // Replace <source>
  document.querySelectorAll("source").forEach(src => {
    const url = src.srcset || src.src;
    if (url && isValidImgURL(url)) {
      src.srcset = PLACEHOLDER;
      src.src = PLACEHOLDER;
    }
  });

  // Replace text nodes - FIXED VERSION
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim().length > 0) {
        node.textContent = "Pixel Pilot";
      }
      return; // Text nodes don't have children
    }

    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling; // Save reference BEFORE recursion
      walk(child);
      child = next; // Use saved reference
    }
  }
  walk(document.body);

  console.log('🟢 DOM manipulation complete');
});

// Final guaranteed wait (Backstop will respect this)
await page.waitForTimeout(1500);

console.log('🟢 END: Ready script finished fully');