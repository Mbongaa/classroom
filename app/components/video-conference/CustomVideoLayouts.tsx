'use client';

import React from 'react';
import {
  useTracks,
  useParticipants,
  useLocalParticipant,
  TrackReference,
  isTrackReference,
} from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { CustomParticipantTile } from './CustomParticipantTile';
import { VideoErrorBoundary } from './VideoErrorBoundary';
import clsx from 'clsx';

interface CustomVideoLayoutProps {
  layoutMode: 'grid' | 'focus' | 'spotlight';
  className?: string;
}

// Grid Layout Component - Mobile-first responsive design
export function GridLayout({ tracks }: { tracks: TrackReference[] }) {
  const participantTracks = tracks.filter(isTrackReference);
  const count = participantTracks.length;

  // Track window size for dynamic adjustments
  const [windowWidth, setWindowWidth] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [windowHeight, setWindowHeight] = React.useState(
    typeof window !== 'undefined' ? window.innerHeight : 768
  );

  React.useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Detect mobile portrait orientation
  const isMobilePortrait = windowWidth < 768 && windowHeight > windowWidth;

  // Mobile-first grid classes - optimized for different screen sizes with better mobile sizing
  const getGridClass = () => {
    // Determine grid columns based on participant count and screen size
    let gridClass = "grid gap-2 h-full w-full auto-rows-fr ";

    // Mobile (default) - Optimized for iPhone visibility
    if (count === 1) {
      gridClass += "grid-cols-1 ";
    } else if (count <= 4) {
      gridClass += "grid-cols-1 ";  // Single column for 2-4 participants (larger tiles)
    } else if (count <= 6) {
      gridClass += "grid-cols-2 ";  // 2 columns only for 5-6
    } else if (count <= 9) {
      gridClass += "grid-cols-2 ";  // Keep 2 columns for 7-9
    } else {
      gridClass += "grid-cols-3 ";  // 3 columns for 10+ (still visible)
    }

    // Small phones (sm: 640px+) - intermediate step
    if (count === 1) {
      gridClass += "sm:grid-cols-1 ";
    } else if (count === 2) {
      gridClass += "sm:grid-cols-2 ";
    } else if (count <= 4) {
      gridClass += "sm:grid-cols-2 ";
    } else if (count <= 9) {
      gridClass += "sm:grid-cols-3 ";
    } else {
      gridClass += "sm:grid-cols-3 ";
    }

    // Tablet (md: 768px+)
    if (count === 1) {
      gridClass += "md:grid-cols-1 ";
    } else if (count === 2) {
      gridClass += "md:grid-cols-2 ";
    } else if (count <= 4) {
      gridClass += "md:grid-cols-2 ";
    } else if (count <= 9) {
      gridClass += "md:grid-cols-3 ";
    } else {
      gridClass += "md:grid-cols-4 ";
    }

    // Desktop (lg: 1024px+)
    if (count === 1) {
      gridClass += "lg:grid-cols-1 ";
    } else if (count === 2) {
      gridClass += "lg:grid-cols-2 ";
    } else if (count <= 6) {
      gridClass += "lg:grid-cols-3 ";
    } else if (count <= 12) {
      gridClass += "lg:grid-cols-4 ";
    } else if (count <= 20) {
      gridClass += "lg:grid-cols-5 ";
    } else {
      gridClass += "lg:grid-cols-6 ";
    }

    // XL screens (xl: 1280px+)
    if (count === 1) {
      gridClass += "xl:grid-cols-1 ";
    } else if (count === 2) {
      gridClass += "xl:grid-cols-2 ";
    } else if (count <= 4) {
      gridClass += "xl:grid-cols-3 ";
    } else if (count <= 8) {
      gridClass += "xl:grid-cols-4 ";
    } else if (count <= 15) {
      gridClass += "xl:grid-cols-5 ";
    } else if (count <= 24) {
      gridClass += "xl:grid-cols-6 ";
    } else {
      gridClass += "xl:grid-cols-7 ";
    }

    return gridClass;
  };

  // Special handling for single participant - minimal wrapper structure
  if (count === 1) {
    // For single participant, return tile directly with minimal wrapper
    // The parent container already handles centering and sizing
    return (
      <div className={clsx(
        "h-full w-full flex items-center justify-center",
        isMobilePortrait ? "p-4" : "p-8"
      )}>
        <CustomParticipantTile
          trackRef={participantTracks[0]}
          className={clsx(
            "w-full h-full",
            isMobilePortrait
              ? "max-w-[350px] max-h-[350px]" // Mobile: square constraint
              : "max-w-5xl max-h-[85vh]"      // Desktop: wider constraint
          )}
          aspectRatio={isMobilePortrait ? "1:1" : "16:9"}
        />
      </div>
    );
  }

  // Alternative approach using auto-fit for maximum flexibility
  const useAutoFit = count > 12; // Use auto-fit for larger groups

  // Dynamic minimum size based on screen width for better mobile experience
  const getMinTileSize = () => {
    if (windowWidth < 640) return '200px';  // Mobile: larger minimum
    if (windowWidth < 768) return '180px';  // Small tablet
    if (windowWidth < 1024) return '160px'; // Tablet
    return '150px';  // Desktop: can be smaller
  };

  if (useAutoFit) {
    return (
      <div className="h-full w-full flex items-center justify-center p-2 md:p-4">
        <div className="w-full h-full max-w-7xl">
          <div
            className="grid gap-2 w-full h-full place-items-center auto-rows-fr"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${getMinTileSize()}), 1fr))`,
              gridAutoRows: `minmax(${getMinTileSize()}, 1fr)`,
            }}
          >
            {participantTracks.map((track) => (
              <div
                key={`${track.participant.identity}_${track.source}`}
                className="relative w-full h-full min-h-[140px] sm:min-h-[160px] md:min-h-[180px] lg:min-h-[200px] max-h-[400px] aspect-video bg-gray-900 rounded-lg overflow-hidden"
              >
                <CustomParticipantTile
                  trackRef={track}
                  className="absolute inset-0"
                  aspectRatio="16:9"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Standard grid for smaller groups (better control)
  return (
    <div className={clsx(
      "h-full w-full flex items-center justify-center",
      isMobilePortrait ? "p-2" : "p-2 md:p-4"
    )}>
      <div className="w-full h-full max-w-7xl">
        <div className={getGridClass()}>
          {participantTracks.map((track) => (
            <div
              key={`${track.participant.identity}_${track.source}`}
              className={clsx(
                "relative w-full h-full bg-gray-900 rounded-lg overflow-hidden",
                // Enhanced minimum heights for better mobile visibility
                count === 2 && isMobilePortrait && "min-h-[250px] min-w-[250px]", // Square-ish for 2 on mobile portrait
                count === 2 && !isMobilePortrait && "min-h-[280px] sm:min-h-[320px] md:min-h-[380px] lg:min-h-[420px]", // Larger for 2
                count <= 4 && count > 2 && "min-h-[200px] sm:min-h-[240px] md:min-h-[280px]", // Larger for 3-4
                count <= 6 && count > 4 && "min-h-[160px] sm:min-h-[180px] md:min-h-[200px]", // Medium for 5-6
                count > 6 && "min-h-[120px] sm:min-h-[140px] md:min-h-[160px]", // Standard for 7+
                !isMobilePortrait && "aspect-video"
              )}
            >
              <CustomParticipantTile
                trackRef={track}
                className="absolute inset-0"
                aspectRatio={isMobilePortrait && count <= 2 ? "1:1" : "16:9"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Focus Layout Component - Mobile-optimized with main video + thumbnails
export function FocusLayout({ tracks }: { tracks: TrackReference[] }) {
  const participantTracks = tracks.filter(isTrackReference);
  const [focusedTrack, setFocusedTrack] = React.useState<TrackReference | null>(null);

  // Track window size for responsive adjustments
  const [windowWidth, setWindowWidth] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [windowHeight, setWindowHeight] = React.useState(
    typeof window !== 'undefined' ? window.innerHeight : 768
  );

  React.useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobilePortrait = windowWidth < 768 && windowHeight > windowWidth;

  // Set initial focus to screen share or first speaking participant
  React.useEffect(() => {
    const screenShare = participantTracks.find(
      track => track.source === Track.Source.ScreenShare
    );

    if (screenShare) {
      setFocusedTrack(screenShare);
    } else if (!focusedTrack && participantTracks.length > 0) {
      setFocusedTrack(participantTracks[0]);
    }
  }, [participantTracks]);

  const otherTracks = participantTracks.filter(
    track => track !== focusedTrack
  );

  return (
    <div className="flex flex-col h-full">
      {/* Main focused video - responsive padding */}
      <div className="flex-1 p-1 md:p-2 min-h-0">
        {focusedTrack && (
          <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
            <CustomParticipantTile
              trackRef={focusedTrack}
              className="absolute inset-0"
              aspectRatio={isMobilePortrait && participantTracks.length === 1 ? "1:1" : "16:9"}
            />
          </div>
        )}
      </div>

      {/* Thumbnails row - responsive height and sizing */}
      {otherTracks.length > 0 && (
        <div className="h-20 md:h-28 lg:h-32 border-t border-gray-800 bg-black/50 flex-shrink-0">
          <div className="flex gap-1 md:gap-2 p-1 md:p-2 h-full overflow-x-auto scrollbar-thin">
            {otherTracks.map((track) => (
              <div
                key={`${track.participant.identity}_${track.source}`}
                className="w-16 h-16 md:w-24 md:h-24 lg:w-28 lg:h-28 flex-shrink-0 cursor-pointer rounded-md overflow-hidden bg-gray-900 hover:ring-2 hover:ring-blue-500"
                onClick={() => setFocusedTrack(track)}
              >
                <CustomParticipantTile
                  trackRef={track}
                  className="w-full h-full"
                  aspectRatio="1:1"
                  showSpeakingIndicator={false}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Spotlight Layout - Mobile-responsive presenter mode
export function SpotlightLayout({ tracks }: { tracks: TrackReference[] }) {
  const participantTracks = tracks.filter(isTrackReference);
  const { localParticipant } = useLocalParticipant();

  // Track window size for responsive adjustments
  const [windowWidth, setWindowWidth] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [windowHeight, setWindowHeight] = React.useState(
    typeof window !== 'undefined' ? window.innerHeight : 768
  );

  React.useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobilePortrait = windowWidth < 768 && windowHeight > windowWidth;

  // Find presenter (screen share or designated presenter)
  const presenterTrack = participantTracks.find(
    track => track.source === Track.Source.ScreenShare
  ) || participantTracks.find(
    track => track.participant === localParticipant
  ) || participantTracks[0];

  const audienceTracks = participantTracks.filter(
    track => track !== presenterTrack && track.source !== Track.Source.ScreenShare
  );

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Main presenter area - full width on mobile, flex-1 on desktop */}
      <div className="flex-1 p-1 md:p-2 min-h-[50%] lg:min-h-0">
        {presenterTrack && (
          <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
            <CustomParticipantTile
              trackRef={presenterTrack}
              className="absolute inset-0"
              aspectRatio={isMobilePortrait && participantTracks.length === 1 ? "1:1" : "16:9"}
            />
          </div>
        )}
      </div>

      {/* Audience section - bottom on mobile, sidebar on desktop */}
      {audienceTracks.length > 0 && (
        <div className={clsx(
          "flex-shrink-0",
          // Mobile: horizontal scroll at bottom
          "h-32 md:h-40 lg:h-full",
          "w-full lg:w-72 xl:w-80",
          // Border positioning
          "border-t lg:border-t-0 lg:border-l border-gray-800",
          "bg-black/50",
          // Scroll behavior
          "overflow-x-auto lg:overflow-x-visible",
          "overflow-y-hidden lg:overflow-y-auto"
        )}>
          {/* Mobile: horizontal layout, Desktop: vertical layout */}
          <div className="flex lg:block h-full lg:h-auto">
            {/* Mobile layout */}
            <div className="flex lg:hidden gap-1 md:gap-2 p-1 md:p-2 h-full">
              {audienceTracks.map((track) => (
                <div
                  key={`${track.participant.identity}_${track.source}`}
                  className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-md overflow-hidden bg-gray-900"
                >
                  <CustomParticipantTile
                    trackRef={track}
                    className="w-full h-full"
                    aspectRatio="1:1"
                    showSpeakingIndicator={true}
                  />
                </div>
              ))}
            </div>

            {/* Desktop layout */}
            <div className="hidden lg:block p-2">
              <h3 className="text-white text-sm font-semibold mb-2 px-1">
                Participants ({audienceTracks.length})
              </h3>
              <div className="space-y-2">
                {audienceTracks.map((track) => (
                  <div
                    key={`${track.participant.identity}_${track.source}`}
                    className="w-full aspect-video bg-gray-900 rounded-lg overflow-hidden"
                  >
                    <CustomParticipantTile
                      trackRef={track}
                      className="w-full h-full"
                      aspectRatio="16:9"
                      showSpeakingIndicator={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Layout Manager Component
export function CustomVideoLayouts({
  layoutMode = 'grid',
  className,
}: CustomVideoLayoutProps) {
  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false }
  );

  const renderLayout = () => {
    switch (layoutMode) {
      case 'focus':
        return (
          <VideoErrorBoundary fallbackMessage="Error loading focus layout. Please refresh the page.">
            <FocusLayout tracks={tracks} />
          </VideoErrorBoundary>
        );
      case 'spotlight':
        return (
          <VideoErrorBoundary fallbackMessage="Error loading spotlight layout. Please refresh the page.">
            <SpotlightLayout tracks={tracks} />
          </VideoErrorBoundary>
        );
      case 'grid':
      default:
        return (
          <VideoErrorBoundary fallbackMessage="Error loading grid layout. Please refresh the page.">
            <GridLayout tracks={tracks} />
          </VideoErrorBoundary>
        );
    }
  };

  return (
    <VideoErrorBoundary fallbackMessage="Error loading video conference. Please refresh the page.">
      <div className={clsx('w-full h-full bg-black', className)}>
        {tracks.length > 0 ? (
          renderLayout()
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-6xl mb-4">⏳</div>
              <p className="text-gray-400 text-lg">Waiting for participants to join...</p>
            </div>
          </div>
        )}
      </div>
    </VideoErrorBoundary>
  );
}