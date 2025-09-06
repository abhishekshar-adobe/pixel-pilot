report({
  "testSuite": "BackstopJS",
  "tests": [
    {
      "pair": {
        "reference": "../bitmaps_reference/backstop_default_Home_0_document_0_Tablet_Landscape.png",
        "test": "../bitmaps_test/20250826-160813/backstop_default_Home_0_document_0_Tablet_Landscape.png",
        "selector": "document",
        "fileName": "backstop_default_Home_0_document_0_Tablet_Landscape.png",
        "label": "Home",
        "requireSameDimensions": true,
        "misMatchThreshold": 0.1,
        "url": "https://www.adobe.com/in/",
        "referenceUrl": "https://www.adobe.com/in/",
        "expect": 0,
        "viewportLabel": "Tablet Landscape",
        "diff": {
          "isSameDimensions": true,
          "dimensionDifference": {
            "width": 0,
            "height": 0
          },
          "rawMisMatchPercentage": 0.02005495859621451,
          "misMatchPercentage": "0.02",
          "analysisTime": 29
        }
      },
      "status": "pass"
    },
    {
      "pair": {
        "reference": "../bitmaps_reference/backstop_default_Home_0_document_1_Mobile_Portrait.png",
        "test": "../bitmaps_test/20250826-160813/backstop_default_Home_0_document_1_Mobile_Portrait.png",
        "selector": "document",
        "fileName": "backstop_default_Home_0_document_1_Mobile_Portrait.png",
        "label": "Home",
        "requireSameDimensions": true,
        "misMatchThreshold": 0.1,
        "url": "https://www.adobe.com/in/",
        "referenceUrl": "https://www.adobe.com/in/",
        "expect": 0,
        "viewportLabel": "Mobile Portrait",
        "diff": {
          "isSameDimensions": true,
          "dimensionDifference": {
            "width": 0,
            "height": 0
          },
          "rawMisMatchPercentage": 0.03355237727097024,
          "misMatchPercentage": "0.03",
          "analysisTime": 13
        }
      },
      "status": "pass"
    }
  ],
  "id": "backstop_default"
});