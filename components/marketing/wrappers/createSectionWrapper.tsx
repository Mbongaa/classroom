import type { ComponentType } from 'react';

interface SectionWrapperOptions<P extends object = {}> {
  desktop: ComponentType<P>;
  /** When provided, rendered alongside desktop and toggled via CSS media query
   *  so the server response is correct for both viewports without a JS swap. */
  mobile?: ComponentType<P>;
}

export function createSectionWrapper<P extends object = {}>({
  desktop: Desktop,
  mobile: Mobile,
}: SectionWrapperOptions<P>) {
  if (!Mobile) {
    return function SectionWrapper(props: P) {
      return <Desktop {...props} />;
    };
  }
  return function SectionWrapper(props: P) {
    return (
      <>
        <div className="mkt-only-desktop">
          <Desktop {...props} />
        </div>
        <div className="mkt-only-mobile">
          <Mobile {...props} />
        </div>
      </>
    );
  };
}
