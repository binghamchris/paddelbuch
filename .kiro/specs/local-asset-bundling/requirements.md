# Requirements Document

## Introduction

This feature removes all external CDN dependencies from the Paddel Buch Jekyll site by bundling Bootstrap CSS/JS, Leaflet CSS/JS, Leaflet Locate Control CSS/JS, and Google Fonts (Fredoka, Quicksand) locally. This improves site reliability, enables offline-capable builds, eliminates third-party requests for better privacy, and resolves Content Security Policy violations caused by external resource loading.

## Glossary

- **Bootstrap**: A CSS and JavaScript framework for responsive web design (version 5.3.2)
- **Leaflet**: A JavaScript library for interactive maps (version 1.9.4)
- **Leaflet_Locate_Control**: A Leaflet plugin that adds a locate-me button to the map (version 0.79.0)
- **Google_Fonts**: Web font service providing Fredoka and Quicksand font families
- **Font_Files**: Local font files in woff2 format for offline font serving
- **Build_System**: The combination of npm scripts and Jekyll build that produces the final site
- **Sass_Compiler**: Jekyll's built-in Sass/SCSS compilation pipeline
- **Amplify**: AWS Amplify hosting service that builds and deploys the site
- **Copy_Script**: A Node.js script that copies vendor assets from node_modules to Jekyll asset directories
- **Font_Download_Script**: A Node.js script that downloads Google Font files and generates local @font-face CSS

## Requirements

### Requirement 1: Local Bootstrap CSS Compilation

**User Story:** As a site owner, I want Bootstrap CSS compiled locally from SCSS sources, so that the site does not depend on cdn.jsdelivr.net for styling.

#### Acceptance Criteria

1. WHEN the Jekyll site builds, THE Sass_Compiler SHALL compile Bootstrap SCSS from local node_modules into the final CSS output
2. WHEN Bootstrap SCSS is imported, THE Sass_Compiler SHALL resolve the import from the node_modules/bootstrap/scss directory via the configured load path
3. WHEN the site is served, THE Browser SHALL load Bootstrap styles from local assets instead of cdn.jsdelivr.net

### Requirement 2: Local Bootstrap JavaScript

**User Story:** As a site owner, I want Bootstrap JavaScript bundled locally, so that interactive components (navbar toggle, dropdowns) work without external dependencies.

#### Acceptance Criteria

1. WHEN the Jekyll site builds, THE Copy_Script SHALL copy the Bootstrap JavaScript bundle from node_modules to the Jekyll assets directory
2. WHEN the site is served, THE Browser SHALL load Bootstrap JavaScript from local assets instead of cdn.jsdelivr.net
3. WHEN Bootstrap JavaScript loads, THE Interactive_Components (navbar toggle, dropdowns) SHALL function correctly

### Requirement 3: Local Leaflet CSS and JavaScript

**User Story:** As a site owner, I want Leaflet CSS and JavaScript bundled locally, so that the map functionality does not depend on unpkg.com.

#### Acceptance Criteria

1. WHEN the Jekyll site builds, THE Copy_Script SHALL copy Leaflet CSS from node_modules to the Jekyll assets directory
2. WHEN the Jekyll site builds, THE Copy_Script SHALL copy Leaflet JavaScript from node_modules to the Jekyll assets directory
3. WHEN the Jekyll site builds, THE Copy_Script SHALL copy Leaflet image assets (marker icons, layer controls) from node_modules to the Jekyll assets directory
4. WHEN the site is served, THE Browser SHALL load Leaflet CSS and JavaScript from local assets instead of unpkg.com
5. WHEN Leaflet CSS references image assets, THE CSS_Paths SHALL resolve to the correct local image files

### Requirement 4: Local Leaflet Locate Control CSS and JavaScript

**User Story:** As a site owner, I want Leaflet Locate Control bundled locally, so that the locate-me button works without depending on cdn.jsdelivr.net.

#### Acceptance Criteria

1. WHEN the Jekyll site builds, THE Copy_Script SHALL copy Leaflet Locate Control CSS from node_modules to the Jekyll assets directory
2. WHEN the Jekyll site builds, THE Copy_Script SHALL copy Leaflet Locate Control JavaScript from node_modules to the Jekyll assets directory
3. WHEN the site is served, THE Browser SHALL load Leaflet Locate Control from local assets instead of cdn.jsdelivr.net

### Requirement 5: Local Google Fonts (Fredoka and Quicksand)

**User Story:** As a site owner, I want Fredoka and Quicksand fonts bundled locally, so that typography renders without external requests to fonts.googleapis.com and fonts.gstatic.com.

#### Acceptance Criteria

1. WHEN the Font_Download_Script runs, THE Font_Download_Script SHALL download Fredoka font files (weights 300, 400, 500) in woff2 format to the local assets directory
2. WHEN the Font_Download_Script runs, THE Font_Download_Script SHALL download Quicksand font files (weights 400, 500, 700) in woff2 format to the local assets directory
3. WHEN the Font_Download_Script runs, THE Font_Download_Script SHALL generate a CSS file containing @font-face declarations that reference local font file paths
4. WHEN the site is served, THE Browser SHALL load Fredoka and Quicksand fonts from local assets instead of fonts.googleapis.com
5. FOR ALL @font-face declarations in the generated font CSS, THE Font_Paths SHALL be valid relative paths that resolve to existing font files in the assets directory

### Requirement 6: Automated Build Pipeline

**User Story:** As a developer, I want the build process automated, so that npm dependencies are installed and all vendor assets are copied during deployment without manual intervention.

#### Acceptance Criteria

1. WHEN Amplify runs the build, THE Build_System SHALL execute npm install before the Jekyll build
2. WHEN npm install completes, THE Build_System SHALL run the Font_Download_Script to download Google Fonts
3. WHEN font download completes, THE Build_System SHALL run the Copy_Script to copy all vendor assets from node_modules to the Jekyll assets directory
4. WHEN the build completes, THE Site SHALL contain all vendor assets (Bootstrap, Leaflet, Leaflet Locate Control, fonts) without requiring manual intervention

### Requirement 7: Jekyll Sass Load Path Configuration

**User Story:** As a developer, I want Jekyll configured to resolve Bootstrap SCSS imports from node_modules, so that Sass compilation works with the local Bootstrap source.

#### Acceptance Criteria

1. WHEN Jekyll compiles Sass, THE Sass_Compiler SHALL include node_modules in the Sass load paths
2. WHEN Bootstrap is imported in SCSS, THE Sass_Compiler SHALL resolve the import from node_modules/bootstrap/scss
3. WHEN custom styles reference Bootstrap variables, THE Sass_Compiler SHALL make Bootstrap variables and mixins available for use

### Requirement 8: Layout CDN Reference Removal

**User Story:** As a site owner, I want all CDN references removed from the HTML layout, so that no external requests are made for CSS, JavaScript, or font resources.

#### Acceptance Criteria

1. WHEN the site is built, THE Layout SHALL contain zero references to cdn.jsdelivr.net
2. WHEN the site is built, THE Layout SHALL contain zero references to unpkg.com
3. WHEN the site is built, THE Layout SHALL contain zero references to fonts.googleapis.com
4. WHEN the site is built, THE Layout SHALL contain zero references to fonts.gstatic.com
5. WHEN the site is built, THE Layout SHALL reference all CSS, JavaScript, and font assets using local relative paths

### Requirement 9: Content Security Policy Update

**User Story:** As a site owner, I want the Content Security Policy updated to remove CDN allowances, so that the CSP accurately reflects the locally-bundled asset sources.

#### Acceptance Criteria

1. WHEN the site is deployed, THE Content_Security_Policy SHALL remove cdn.jsdelivr.net from allowed sources
2. WHEN the site is deployed, THE Content_Security_Policy SHALL remove unpkg.com from allowed sources
3. WHEN the site is deployed, THE Content_Security_Policy SHALL remove fonts.googleapis.com and fonts.gstatic.com from allowed sources
4. WHEN the site is deployed, THE Content_Security_Policy SHALL allow 'self' as the source for styles, scripts, fonts, and images
