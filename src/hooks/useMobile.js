import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Natively check touch capability physics
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Specifically target mobile UserAgents ignoring screen-width masking
      const isMobileAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Secondary check for tablets/phones claiming desktop arrays logic
      const isNarrow = window.innerWidth <= 950;
      
      // Hard binary evaluation
      setIsMobile((hasTouch && isNarrow) || isMobileAgent);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}
