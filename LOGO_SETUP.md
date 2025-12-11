# Logo Setup Instructions

## Adding Your Company Logo

To add your company logo to the application:

### Step 1: Prepare Your Logo Image

1. **Image Format:** PNG, SVG, or JPG
2. **Recommended Size:** 
   - Minimum: 200x200 pixels
   - Optimal: 400x400 pixels (for high-resolution displays)
3. **Background:** Transparent (PNG) or white background
4. **File Name:** `logo.png` (or `logo.svg`, `logo.jpg`)

### Step 2: Place the Logo File

1. Copy your logo image file
2. Place it in the `public` folder:
   ```
   public/logo.png
   ```
   or
   ```
   public/logo.svg
   ```
   or
   ```
   public/logo.jpg
   ```

### Step 3: Update the Component (if needed)

If your logo file has a different name or format, update `components/CompanyLogo.tsx`:

```tsx
// Change this line:
src="/logo.png"

// To your file name:
src="/your-logo-name.png"
```

### Step 4: Verify

1. Start the development server: `npm run dev`
2. Check the login page - logo should appear to the left of "Trayvo"
3. Check the sidebar - logo should appear in the header

## Logo Display Locations

The logo appears in:
- ✅ **Login Page:** Logo + "Trayvo" text (large size)
- ✅ **Sidebar Header:** Logo + "Trayvo" text (medium size)

## Logo Sizes

The component supports three sizes:
- **Small (sm):** 24x24 pixels
- **Medium (md):** 32x32 pixels (default)
- **Large (lg):** 48x48 pixels

## Troubleshooting

**Logo not showing?**
1. Check file is in `public` folder
2. Check file name matches (case-sensitive)
3. Check browser console for errors
4. Verify image format is supported (PNG, SVG, JPG)

**Logo too large/small?**
- Adjust the size prop in the component usage
- Or resize your image file

**Logo appears but text color is wrong?**
- The component automatically adjusts text color based on background
- For sidebar (blue background), text is white
- For login page (white background), text is dark gray

