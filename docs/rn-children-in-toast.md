# Rendering React Native Children Inside the Toast

## Goal

Allow users to pass arbitrary RN components as toast content via a `render` prop:

```tsx
toast.show({
  render: () => (
    <View style={{ flexDirection: 'row' }}>
      <Image source={require('./check.png')} />
      <Text>Custom content</Text>
    </View>
  ),
});
```

## The Problem

The toast lives in a separate `PassThroughWindow` (overlay UIWindow) above the app. RN children live in the main window's Fabric view hierarchy. To display RN content in the toast, we need to **reparent** the UIView subtree from the Fabric component into the overlay window.

## What We Tried

### Approach: Reparenting (same pattern as RN's `Modal`)

The Fabric view (`ToastView`) overrides `mountChildComponentView:index:` and `unmountChildComponentView:index:` to track children. When the toast shows, children are moved from the Fabric view into the `ToastContainerView`'s content container in the overlay window.

**Files involved:**
- `ToastView.mm` — Fabric view with mount/unmount overrides and `_trackedChildren` array
- `ToastContainerView.swift` — pill view with `contentContainer` that receives the reparented children

### Issue 1: Crash on unmount

When React removes the `ToastView` from the tree, `unmountChildComponentView:index:` asserts the child is at the expected index in `self.subviews`. Since children were moved to the overlay window, the assertion fails.

**Fix:** Override `unmountChildComponentView:index:` to call `[childComponentView removeFromSuperview]` without index checks, and track children in a separate `_trackedChildren` array.

### Issue 2: Layout — children rendered too small / mispositioned

This is the **unsolved** problem. When children are reparented into the overlay window:

1. **Yoga layout is relative to the Fabric view**, not the toast container. The children's frames are computed based on the `ToastView`'s position in the RN tree (e.g. `{ position: 'absolute', top: 0, left: 0, right: 0, height: 90 }`).

2. **Manually setting `child.frame`** gets overwritten by Yoga on the next layout pass.

3. **Scale transforms conflict with `layoutSubviews`**: The original SwiftUI implementation uses `scaleEffect` on content that's always at expanded size. In UIKit, `layoutSubviews` fires during animation and resets `contentContainer.frame = bounds`, causing a double-shrink (the container is resized to collapsed dimensions AND scaled down by the transform).

4. **Content appears clipped by the Dynamic Island** — even after fixing the double-shrink, the children's Yoga-computed positions don't account for the toast container's coordinate system.

### Root Cause

Yoga's layout engine doesn't know the children moved to a different container. It continues computing frames relative to the original parent (`ToastView`). There's no API to tell Yoga "this subtree now has a different parent size."

## Possible Solutions (Not Yet Attempted)

### 1. Create a separate React Native Surface

Instead of reparenting views, create a new `RCTFabricSurface` in the overlay window and render the toast content as an independent React root. This is how `Modal` works internally on the new architecture.

**Pros:** Clean separation, Yoga computes layout correctly  
**Cons:** Heavier, needs a bridge to pass the render function's output as a component to the new surface

### 2. Use `RCTModalHostView` as reference

Study how `RCTModalHostView` in React Native's core handles reparenting on Fabric. It creates a new `RCTFabricSurfaceHostingView` inside a `UIViewController` presented modally.

**Key files to study:**
- `packages/react-native/React/Fabric/Mounting/ComponentViews/Modal/RCTModalHostViewComponentView.mm`

### 3. Override Yoga layout for reparented children

After reparenting, manually set the children's Yoga node to match the toast container dimensions. This would require accessing the Yoga tree, which is internal to Fabric.

### 4. Wrapper approach

Wrap the RN children in a native container that has a fixed size matching the expanded toast dimensions, and set this container as the `contentView` of the Fabric component. The wrapper would isolate Yoga layout from the reparenting.

## Current Solution

For v1, we use **native rendering**: `icon` (SF Symbol), `title`, and `message` as string props, rendered with UIKit views (UIImageView + UILabels) on the native side. This avoids reparenting entirely and matches the original SwiftUI implementation.

The `render` prop can be added later once one of the above solutions is implemented.
