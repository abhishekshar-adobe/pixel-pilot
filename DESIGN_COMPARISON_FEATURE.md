# Design-to-Code Comparison Feature

## Overview

The Design-to-Code Comparison feature allows you to automatically compare your live website implementation with Figma design specifications to identify visual inconsistencies. This helps ensure your implementation matches the intended design accurately.

## How It Works

1. **BackstopJS Test Runs** - The system captures screenshots and extracts DOM data during visual regression tests
2. **DOM Data Extraction** - CSS properties, font sizes, colors, and spacing are captured from live elements
3. **Figma API Integration** - Design tokens and component specifications are fetched from your Figma files
4. **Automated Comparison** - The system compares DOM data against Figma specs to identify mismatches
5. **Detailed Reports** - Mismatches are reported with element names, specific issues, and severity levels

## Getting Started

### 1. Figma Setup

First, you'll need to set up access to your Figma files:

1. **Generate a Figma Access Token:**
   - Go to Figma → Settings → Account → Personal access tokens
   - Create a new token and copy it

2. **Get Your Figma File Key:**
   - Open your Figma file in the browser
   - Copy the file key from the URL: `https://www.figma.com/file/{FILE_KEY}/...`

### 2. Configure Design Comparison

1. Navigate to the **Design Comparison** tab in PixelPilot
2. Click **Configure** to open the settings dialog
3. Enter your Figma Access Token and File Key
4. Adjust tolerance settings:
   - **Font Size (px)**: Acceptable difference in font sizes
   - **Spacing (px)**: Acceptable difference in margins/padding
   - **Color Diff**: Acceptable color difference threshold

### 3. Run Comparisons

1. **Select Scenarios**: Choose which test scenarios to include in the comparison
2. **Run Batch Comparison**: Execute the comparison across all selected scenarios
3. **View Reports**: Review detailed mismatch reports with severity levels

## Features

### DOM Data Extraction

The system captures comprehensive styling information from your live site:

- **Typography**: Font family, size, weight, line height, color
- **Layout**: Margins, padding, positioning, dimensions
- **Colors**: Text colors, background colors, border colors
- **Visual Effects**: Border radius, shadows, opacity

### Figma Integration

Automatically extracts design specifications from Figma:

- **Design Tokens**: Colors, typography, spacing variables
- **Component Specs**: Individual component styling and properties
- **Text Styles**: Font specifications and character styling
- **Layout Properties**: Padding, margins, and spacing definitions

### Intelligent Matching

The comparison engine uses sophisticated matching algorithms:

- **Content-based Matching**: Matches elements by text content similarity
- **Class-based Matching**: Matches elements by CSS class names
- **Position-based Matching**: Considers element positioning and hierarchy
- **Fuzzy Matching**: Handles minor variations in naming and content

### Detailed Reports

Comprehensive reporting with actionable insights:

- **Severity Levels**: Major, Moderate, and Minor issues
- **Property-specific Details**: Exact values and differences
- **Visual Reports**: HTML reports with tables and statistics
- **Export Options**: JSON and HTML report formats

## Report Interpretation

### Severity Levels

- **🔴 Major**: Issues that significantly impact visual appearance
- **🟡 Moderate**: Noticeable differences that may affect user experience
- **🔵 Minor**: Small variations within acceptable tolerance ranges

### Common Issues

- **Font Size Mismatches**: Implementation uses different font sizes than specified
- **Color Variations**: Slight differences in color values
- **Spacing Inconsistencies**: Margins or padding don't match design specs
- **Typography Differences**: Wrong font families or weights used

## API Endpoints

The feature provides comprehensive REST API endpoints:

### Configuration
- `POST /api/design-comparison/config` - Configure Figma settings
- `GET /api/design-comparison/config` - Get current configuration

### Comparison Execution
- `POST /api/design-comparison/run` - Run comparison for single scenario
- `POST /api/design-comparison/batch` - Run batch comparison for multiple scenarios

### Reports Management
- `GET /api/design-comparison/reports` - List all comparison reports
- `GET /api/design-comparison/reports/:filename` - Get specific report data
- `GET /api/design-comparison/reports/:filename/html` - View HTML report
- `DELETE /api/design-comparison/reports/:filename` - Delete report

### BackstopJS Integration
- `GET /api/design-comparison/backstop-script` - Get integration script for BackstopJS

## Configuration Options

### Tolerance Settings

Fine-tune comparison sensitivity:

```javascript
{
  "tolerance": {
    "fontSize": 2,    // Acceptable font size difference in pixels
    "spacing": 4,     // Acceptable spacing difference in pixels
    "color": 10       // Acceptable color difference threshold
  }
}
```

### Scenario Configuration

Enable design comparison for specific scenarios:

```javascript
{
  "label": "Homepage",
  "url": "https://example.com",
  "enableDesignComparison": true,
  "figmaFileKey": "your-figma-file-key"
}
```

## Integration with BackstopJS

The feature seamlessly integrates with your existing BackstopJS workflows:

1. **Automatic DOM Extraction**: Data is captured during regular screenshot tests
2. **No Performance Impact**: Extraction runs alongside existing test processes
3. **Scenario-based**: Enable/disable per scenario as needed
4. **Cached Results**: Figma data is cached to improve performance

## Best Practices

### Figma File Organization

- **Use Consistent Naming**: Name components and text styles clearly
- **Organize with Frames**: Group related components logically
- **Document Design Tokens**: Use clear variable names for colors and typography
- **Maintain Single Source**: Keep one master file for design specifications

### Testing Strategy

- **Start Small**: Begin with key components and pages
- **Set Realistic Tolerances**: Account for browser rendering differences
- **Regular Comparisons**: Run comparisons after design updates
- **Review Reports**: Actively review and act on identified mismatches

### Performance Optimization

- **Cache Figma Data**: Cached design tokens improve comparison speed
- **Selective Scenarios**: Only enable comparison for critical scenarios
- **Batch Processing**: Run multiple scenarios together for efficiency
- **Regular Cleanup**: Delete old reports to maintain performance

## Troubleshooting

### Common Issues

1. **Figma Access Token Invalid**
   - Verify token is correctly copied
   - Check token hasn't expired
   - Ensure sufficient permissions

2. **No Matches Found**
   - Check element naming consistency
   - Verify Figma file structure
   - Review matching algorithms settings

3. **High Number of False Positives**
   - Adjust tolerance settings
   - Review browser rendering differences
   - Check for dynamic content issues

### Debug Information

Enable detailed logging for troubleshooting:

- Check browser console for DOM extraction errors
- Review server logs for Figma API issues
- Examine report data for matching problems

## Future Enhancements

Planned improvements for the design comparison feature:

- **Advanced Color Matching**: CIEDE2000 color difference algorithm
- **Layout Analysis**: Flexbox and Grid layout comparison
- **Interactive Elements**: Hover states and animation comparison
- **Component Variants**: Support for Figma component variants
- **Design System Integration**: Integration with design token standards
- **AI-Powered Matching**: Machine learning for better element matching

## Support

For questions and support:

1. Check this documentation for common solutions
2. Review the troubleshooting section
3. Examine the detailed error messages in reports
4. Verify Figma API connectivity and permissions

The Design-to-Code Comparison feature represents a significant advancement in automated design QA, helping teams maintain consistency between design specifications and implementation.
