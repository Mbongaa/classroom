# Theme Styling Guide

**Complete guide for implementing theme-responsive styling in the LiveKit Meet application**

## 🎨 LiveKit CSS Variables Reference

### **Available Theme Variables**

#### Background Colors
```css
/* Dark Mode (Default) */
--lk-bg: #000000         /* Pure black - main background */
--lk-bg2: #000000        /* Pure black - chat and controls */
--lk-bg3: #141414        /* Slightly lighter - hover states */
--lk-bg4: #1f1f1f        /* Even lighter - active states */
--lk-bg5: #2a2a2a        /* Lightest dark gray */

/* Light Mode */
--lk-bg: #ffffff         /* White background */
--lk-bg2: #f9f9f9        /* Light gray - chat and controls */
--lk-bg3: #f0f0f0        /* Lighter gray - hover states */
--lk-bg4: #e5e5e5        /* Gray - active states */
--lk-bg5: #d0d0d0        /* Darker gray */
```

#### Text Colors
```css
/* Light Mode Only (Dark mode has no explicit text variables) */
--lk-text1: #1a1a1a      /* Primary text - dark on light background */
--lk-text2: #4a4a4a      /* Secondary text - lighter gray */
```

## 🎯 Theme-Responsive Patterns

### **1. Input Components**
✅ **Correct Pattern**:
```typescript
<input
  className="placeholder:text-gray-400 dark:placeholder:text-gray-500"
  style={{
    backgroundColor: 'var(--lk-bg)',
    color: 'var(--lk-text1, white)',
  }}
/>
```

❌ **Wrong Pattern**:
```typescript
<input
  className="bg-black text-white"  // Hardcoded colors
  style={{ backgroundColor: '#000000' }}  // Hardcoded hex
/>
```

### **2. Select Components**
✅ **Correct Pattern**:
```typescript
<SelectTrigger
  className="[&[data-placeholder]>span]:text-gray-400 dark:[&[data-placeholder]>span]:text-gray-500"
  style={{
    backgroundColor: 'var(--lk-bg)',
    color: 'var(--lk-text1, white)',
  }}
>
```

### **3. Button Components**
✅ **Correct Pattern for Standard Buttons**:
```typescript
<button
  className="bg-black text-white dark:bg-white dark:text-black"
  // OR use CSS variables:
  style={{
    backgroundColor: 'var(--lk-bg2)',
    color: 'var(--lk-text1, white)',
  }}
>
```

### **4. Icon Components**
✅ **Correct Pattern**:
```typescript
<Mic style={{ color: 'var(--lk-text1, white)' }} />
<MicOff style={{ color: 'var(--lk-text2, #6b7280)' }} />
```

❌ **Wrong Pattern**:
```typescript
<Mic className="text-white" />  // Hardcoded
```

## 🔧 Implementation Guidelines

### **CSS Variable Usage Rules**

1. **Primary Text**: Use `var(--lk-text1, white)` for main text content
2. **Secondary Text**: Use `var(--lk-text2, #gray)` for muted/secondary text
3. **Main Background**: Use `var(--lk-bg)` for primary backgrounds
4. **Secondary Background**: Use `var(--lk-bg2)` for control backgrounds
5. **Hover States**: Use `var(--lk-bg3)` for hover backgrounds

### **When to Use Inline Styles vs CSS Classes**

✅ **Use Inline Styles For**:
- Theme-responsive colors using CSS variables
- Dynamic color changes based on component state
- When CSS variables are required

✅ **Use CSS Classes For**:
- Static styling (spacing, layout, typography)
- Tailwind utilities that don't need theme awareness
- Hover/focus states that can use Tailwind modifiers

### **Fallback Strategy**
Always provide fallback colors for CSS variables:
```typescript
color: 'var(--lk-text1, white)'  // Falls back to white if variable unavailable
backgroundColor: 'var(--lk-bg, #000000)'  // Falls back to black
```

## 📝 Component-Specific Examples

### **Input Fields**
```typescript
// Username, search inputs, text areas
<input
  className="placeholder:text-gray-400 dark:placeholder:text-gray-500 border-[#4b5563] hover:border-[#6b7280]"
  style={{
    backgroundColor: 'var(--lk-bg)',
    color: 'var(--lk-text1, white)',
  }}
/>
```

### **Select Dropdowns**
```typescript
// Language selectors, device selectors
<SelectTrigger
  className="[&[data-placeholder]>span]:text-gray-400 dark:[&[data-placeholder]>span]:text-gray-500"
  style={{
    backgroundColor: 'var(--lk-bg)',
    color: 'var(--lk-text1, white)',
  }}
>
  <SelectContent
    style={{
      backgroundColor: 'var(--lk-bg)',
      color: 'var(--lk-text1, white)',
    }}
  >
    <SelectItem
      style={{ color: 'var(--lk-text1, white)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--lk-bg3)';
      }}
    >
```

### **Action Buttons**
```typescript
// Copy buttons, join buttons, action buttons
<button
  className="bg-black text-white dark:bg-white dark:text-black"
  // Icons use same colors:
  <Icon style={{ color: 'var(--lk-text1, white)' }} />
>
```

### **Media Control Icons**
```typescript
// Mic, camera, other control icons
{enabled ?
  <Mic style={{ color: 'var(--lk-text1, white)' }} /> :
  <MicOff style={{ color: 'var(--lk-text2, #6b7280)' }} />
}
```

## ⚠️ Common Mistakes & Solutions

### **Mistake 1: Hardcoded Colors**
❌ **Wrong**:
```typescript
style={{ color: 'white', backgroundColor: '#000000' }}
className="text-white bg-black"
```

✅ **Correct**:
```typescript
style={{
  color: 'var(--lk-text1, white)',
  backgroundColor: 'var(--lk-bg)'
}}
```

### **Mistake 2: Inconsistent Placeholder Styling**
❌ **Wrong**: Mixed browser defaults and custom styling
✅ **Correct**: Consistent placeholder classes across all inputs

### **Mistake 3: CSS Specificity Issues**
❌ **Wrong**: CSS classes overriding inline styles
✅ **Correct**: Use `!important` or higher specificity when needed

### **Mistake 4: Icon Color Inconsistency**
❌ **Wrong**: Mix of hardcoded and theme-aware icon colors
✅ **Correct**: All icons use CSS variables for consistency

## 🧪 Testing Checklist

### **Visual Testing**
- [ ] Switch between light and dark themes
- [ ] Check all text is readable (proper contrast)
- [ ] Verify no white-on-white or black-on-black text
- [ ] Test placeholder text visibility in both themes
- [ ] Check hover states work in both themes

### **Component Testing**
- [ ] Input fields: background, text, placeholder, border colors
- [ ] Select dropdowns: trigger, content, items, placeholder colors
- [ ] Buttons: background, text, icon, border colors
- [ ] Media controls: enabled/disabled icon colors
- [ ] Text containers: title, body text, secondary text colors

### **Accessibility Testing**
- [ ] Contrast ratios meet WCAG guidelines
- [ ] Focus states are visible in both themes
- [ ] Hover states provide clear feedback
- [ ] Disabled states are clearly distinguishable

## 📚 CSS Variable Resolution

### **How CSS Variables Work**
```css
/* Variable Definition */
--lk-bg: #000000;

/* Usage with Fallback */
backgroundColor: 'var(--lk-bg, #fallback-color)'

/* Browser Resolution */
1. Check if --lk-bg is defined
2. If yes, use its value (#000000)
3. If no, use fallback (#fallback-color)
```

### **Theme Switching Mechanism**
The application uses CSS classes to switch themes:
- **Dark Mode**: `[data-lk-theme=default]` selectors apply
- **Light Mode**: `.light [data-lk-theme=default]` selectors override

## 🏗️ Architecture Notes

### **Consistent Theme Application**
- All form controls use same CSS variable approach
- Icons follow enabled/disabled color patterns
- Hover states use `--lk-bg3` for consistency
- Text hierarchy uses `--lk-text1` (primary) and `--lk-text2` (secondary)

### **Component Hierarchy**
1. **Backgrounds**: Use `--lk-bg` (main) or `--lk-bg2` (controls)
2. **Text Colors**: Use `--lk-text1` (primary) or `--lk-text2` (secondary)
3. **Interactive States**: Use `--lk-bg3` for hover backgrounds
4. **Borders**: Use hardcoded grays that work in both themes

## 🎯 Key Takeaways

1. **Always use CSS variables** for theme-responsive colors
2. **Provide fallbacks** for CSS variables
3. **Be consistent** across similar components
4. **Test in both themes** before considering complete
5. **Use inline styles** when CSS variables are needed
6. **Maintain contrast** for accessibility compliance

---

*This guide reflects the patterns established during the theme responsiveness implementation session and should be followed for all future theme-related styling work.*