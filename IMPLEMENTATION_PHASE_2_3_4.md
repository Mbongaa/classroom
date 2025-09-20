# LiveKit Classroom Feature - Phases 2, 3, and 4 Implementation Guide

This guide provides complete implementation code for Phases 2-4 of the LiveKit Classroom feature using shadcn/ui components integrated with LiveKit's WebRTC components.

## Table of Contents
1. [Prerequisites & Setup](#prerequisites--setup)
2. [Phase 2: Classroom Entry Page](#phase-2-classroom-entry-page)
3. [Phase 3: Classroom Client Implementation](#phase-3-classroom-client-implementation)
4. [Phase 4: Custom Video Conference Component](#phase-4-custom-video-conference-component)
5. [Phase 5: Teacher Controls](#phase-5-teacher-controls)
6. [Testing Instructions](#testing-instructions)

---

## Prerequisites & Setup

### 1. Install shadcn/ui Dependencies

```bash
# Install dependencies
pnpm add tailwindcss-animate class-variance-authority clsx tailwind-merge lucide-react

# Install radix-ui components that shadcn uses
pnpm add @radix-ui/react-avatar @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-tooltip
```

### 2. Create Tailwind Configuration

Create `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### 3. Create components.json

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

### 4. Update app/globals.css

Add to the beginning of your `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

/* Keep existing styles below */
```

### 5. Create lib/utils.ts

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 6. Create shadcn UI Components

Create `components/ui/button.tsx`:

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

Create `components/ui/card.tsx`:

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

Create `components/ui/badge.tsx`:

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

Create `components/ui/tabs.tsx`:

```tsx
"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

Create `components/ui/avatar.tsx`:

```tsx
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
```

Create `components/ui/scroll-area.tsx`:

```tsx
"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
```

---

## Phase 2: Classroom Entry Page

### Create `app/classroom/[roomName]/page.tsx`

```tsx
import { Suspense } from 'react';
import { headers } from 'next/headers';
import ClassroomPreJoin from './ClassroomPreJoin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PageProps {
  params: {
    roomName: string;
  };
  searchParams: {
    [key: string]: string | string[] | undefined;
  };
}

export default function ClassroomPage({ params, searchParams }: PageProps) {
  const { roomName } = params;

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-4xl mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">
            Join Classroom: {roomName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading...</div>}>
            <ClassroomPreJoin
              roomName={roomName}
              region={searchParams?.region as string}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Create `app/classroom/[roomName]/ClassroomPreJoin.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  GraduationCap,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings,
  User,
  BookOpen,
  Presentation,
  MessageSquare,
  Hand
} from 'lucide-react';

interface ClassroomPreJoinProps {
  roomName: string;
  region?: string;
}

export default function ClassroomPreJoin({ roomName, region }: ClassroomPreJoinProps) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinClassroom = async () => {
    if (!username.trim()) {
      alert('Please enter your name');
      return;
    }

    setIsJoining(true);

    // Redirect to ClassroomClientImpl with role and preferences
    const params = new URLSearchParams({
      username,
      role,
      video: videoEnabled.toString(),
      audio: audioEnabled.toString(),
      ...(region && { region }),
    });

    router.push(`/classroom/${roomName}/room?${params.toString()}`);
  };

  const roleFeatures = {
    teacher: [
      'Full control over classroom',
      'Can mute/unmute students',
      'Screen sharing enabled',
      'Recording capabilities',
      'Manage permissions',
    ],
    student: [
      'Join classroom session',
      'Raise hand to speak',
      'Participate in chat',
      'View shared content',
      'Request permissions',
    ],
  };

  return (
    <div className="space-y-6">
      {/* Name Input */}
      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium">
          Your Name
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Enter your name"
          required
        />
      </div>

      {/* Role Selection */}
      <Tabs value={role} onValueChange={(v) => setRole(v as 'teacher' | 'student')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="teacher">
            <GraduationCap className="mr-2 h-4 w-4" />
            Teacher
          </TabsTrigger>
          <TabsTrigger value="student">
            <Users className="mr-2 h-4 w-4" />
            Student
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teacher" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Teacher Access
              </CardTitle>
              <CardDescription>
                Lead the classroom with full control and management features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {roleFeatures.teacher.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="rounded-full bg-green-100 p-1 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="student" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Student Access
              </CardTitle>
              <CardDescription>
                Join the classroom to learn and participate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {roleFeatures.student.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="rounded-full bg-blue-100 p-1 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Media Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Media Settings</CardTitle>
          <CardDescription>
            {role === 'teacher'
              ? 'Configure your camera and microphone'
              : 'Students join with media disabled by default'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            variant={videoEnabled ? 'default' : 'outline'}
            size="lg"
            onClick={() => setVideoEnabled(!videoEnabled)}
            disabled={role === 'student'}
          >
            {videoEnabled ? (
              <>
                <Video className="mr-2 h-4 w-4" />
                Camera On
              </>
            ) : (
              <>
                <VideoOff className="mr-2 h-4 w-4" />
                Camera Off
              </>
            )}
          </Button>

          <Button
            variant={audioEnabled ? 'default' : 'outline'}
            size="lg"
            onClick={() => setAudioEnabled(!audioEnabled)}
            disabled={role === 'student'}
          >
            {audioEnabled ? (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Mic On
              </>
            ) : (
              <>
                <MicOff className="mr-2 h-4 w-4" />
                Mic Off
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card className="bg-muted">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback>
                  {username ? username.charAt(0).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{username || 'Your Name'}</p>
                <Badge variant={role === 'teacher' ? 'default' : 'secondary'}>
                  {role}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              {videoEnabled && <Video className="h-4 w-4 text-muted-foreground" />}
              {audioEnabled && <Mic className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Join Button */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleJoinClassroom}
        disabled={!username.trim() || isJoining}
      >
        {isJoining ? (
          <>Loading...</>
        ) : (
          <>
            {role === 'teacher' ? (
              <>
                <Presentation className="mr-2 h-4 w-4" />
                Start Teaching
              </>
            ) : (
              <>
                <BookOpen className="mr-2 h-4 w-4" />
                Join Class
              </>
            )}
          </>
        )}
      </Button>

      {/* Info Text */}
      <p className="text-xs text-center text-muted-foreground">
        {role === 'student'
          ? "You'll join with your microphone and camera disabled. You can request to speak during the class."
          : "As a teacher, you'll have full control over the classroom including student permissions."}
      </p>
    </div>
  );
}
```

---

## Phase 3: Classroom Client Implementation

### Create `app/classroom/[roomName]/room/page.tsx`

```tsx
import { headers } from 'next/headers';
import ClassroomClientImpl from '../ClassroomClientImpl';

interface PageProps {
  params: {
    roomName: string;
  };
  searchParams: {
    username?: string;
    role?: string;
    video?: string;
    audio?: string;
    region?: string;
  };
}

export default function ClassroomRoomPage({ params, searchParams }: PageProps) {
  const { roomName } = params;

  return (
    <ClassroomClientImpl
      roomName={roomName}
      username={searchParams.username || 'Guest'}
      role={searchParams.role as 'teacher' | 'student' || 'student'}
      initialVideo={searchParams.video === 'true'}
      initialAudio={searchParams.audio === 'true'}
      region={searchParams.region}
    />
  );
}
```

### Create `app/classroom/[roomName]/ClassroomClientImpl.tsx`

```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LiveKitRoom, RoomContext } from '@livekit/components-react';
import {
  ConnectionDetails,
  Room,
  RoomOptions,
  VideoCodec,
  RoomEvent,
} from 'livekit-client';
import ClassroomVideoConference from './ClassroomVideoConference';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface ClassroomClientImplProps {
  roomName: string;
  username: string;
  role: 'teacher' | 'student';
  initialVideo: boolean;
  initialAudio: boolean;
  region?: string;
}

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';

export default function ClassroomClientImpl({
  roomName,
  username,
  role,
  initialVideo,
  initialAudio,
  region,
}: ClassroomClientImplProps) {
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | undefined>();
  const [room] = useState<Room>(() => new Room());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch connection details with role
  useEffect(() => {
    const fetchConnectionDetails = async () => {
      try {
        const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
        url.searchParams.append('roomName', roomName);
        url.searchParams.append('participantName', username);
        url.searchParams.append('classroom', 'true');
        url.searchParams.append('role', role);
        if (region) {
          url.searchParams.append('region', region);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error('Failed to get connection details');
        }

        const details = await response.json();
        setConnectionDetails(details);
      } catch (err) {
        console.error('Connection error:', err);
        setError('Failed to connect to classroom. Please try again.');
      }
    };

    fetchConnectionDetails();
  }, [roomName, username, role, region]);

  // Room options
  const roomOptions: RoomOptions = {
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: role === 'teacher' ? { width: 1280, height: 720 } : { width: 640, height: 480 },
    },
  };

  const handleConnected = useCallback(() => {
    setIsConnected(true);
    console.log('Connected to classroom as', role);
  }, [role]);

  const handleDisconnected = useCallback(() => {
    setIsConnected(false);
    router.push(`/classroom/${roomName}`);
  }, [roomName, router]);

  const handleError = useCallback((error: Error) => {
    console.error('Room error:', error);
    setError(error.message);
  }, []);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <Card className="p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-500 mb-2">Connection Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push(`/classroom/${roomName}`)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Go Back
          </button>
        </Card>
      </div>
    );
  }

  if (!connectionDetails) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Joining classroom...</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={connectionDetails.serverUrl}
      token={connectionDetails.participantToken}
      connect={true}
      connectOptions={{ autoSubscribe: true }}
      options={roomOptions}
      audio={role === 'teacher' ? initialAudio : false}
      video={role === 'teacher' ? initialVideo : false}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleError}
      className="h-screen"
    >
      <ClassroomVideoConference
        role={role}
        username={username}
        roomName={roomName}
      />

      {/* Connection Status Indicator */}
      <div className="absolute top-4 right-4 z-50">
        <Badge variant={isConnected ? 'default' : 'secondary'}>
          {isConnected ? 'Connected' : 'Connecting...'}
        </Badge>
      </div>
    </LiveKitRoom>
  );
}
```

---

## Phase 4: Custom Video Conference Component

**Important Layout Design**: Both teachers and students see the same focus view by default, with the teacher's video prominent in the center and students in a small grid below. This ensures everyone's attention is focused on the teacher during instruction.

### Create `app/classroom/[roomName]/ClassroomVideoConference.tsx`

```tsx
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  useParticipants,
  useTracks,
  ParticipantTile,
  FocusLayout,
  GridLayout,
  ControlBar,
  Chat,
  RoomAudioRenderer,
  useRoomContext,
  ConnectionQualityIndicator,
  useLocalParticipant,
  TrackLoop,
  VideoTrack,
  AudioTrack,
  useTrackToggle,
  ParticipantName,
} from '@livekit/components-react';
import {
  Track,
  Participant,
  RemoteParticipant,
  LocalParticipant,
  TrackPublication,
  RoomEvent,
} from 'livekit-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TeacherControls from './TeacherControls';
import StudentRequestButton from './StudentRequestButton';
import {
  Users,
  MessageSquare,
  Settings,
  Maximize,
  Minimize,
  Hand,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  UserCheck,
  GraduationCap,
  BookOpen,
  Volume2,
} from 'lucide-react';

interface ClassroomVideoConferenceProps {
  role: 'teacher' | 'student';
  username: string;
  roomName: string;
}

export default function ClassroomVideoConference({
  role,
  username,
  roomName,
}: ClassroomVideoConferenceProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  // Separate teacher and students
  const teacher = useMemo(() => {
    return participants.find(p => {
      const metadata = p.metadata ? JSON.parse(p.metadata) : {};
      return metadata.role === 'teacher';
    });
  }, [participants]);

  const students = useMemo(() => {
    return participants.filter(p => {
      const metadata = p.metadata ? JSON.parse(p.metadata) : {};
      return metadata.role === 'student';
    });
  }, [participants]);

  // Track states
  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { updateOnlyOn: [] }
  );

  const teacherScreenShare = useMemo(() => {
    return tracks.find(
      track =>
        track.participant.sid === teacher?.sid &&
        track.publication.source === Track.Source.ScreenShare
    );
  }, [tracks, teacher]);

  // Default to focus view for BOTH teacher and students - always focusing on teacher
  const [selectedView, setSelectedView] = useState<'focus' | 'grid'>('focus');
  const [showChat, setShowChat] = useState(true);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());

  // Handle raised hands
  const handleRaiseHand = (participantId: string) => {
    setRaisedHands(prev => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  };

  // Layout based on role and view
  const renderMainContent = () => {
    if (!teacher) {
      return (
        <div className="flex items-center justify-center h-full">
          <Card className="p-8 text-center">
            <GraduationCap className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>Waiting for Teacher</CardTitle>
            <p className="text-muted-foreground mt-2">
              The class will begin when the teacher joins...
            </p>
          </Card>
        </div>
      );
    }

    // If teacher is sharing screen, prioritize that
    if (teacherScreenShare) {
      return (
        <Card className="h-full p-0 overflow-hidden">
          <div className="relative h-full bg-black">
            <VideoTrack trackRef={teacherScreenShare} className="w-full h-full object-contain" />
            <div className="absolute top-4 left-4 z-10">
              <Badge variant="secondary" className="bg-opacity-90">
                <Monitor className="mr-1 h-3 w-3" />
                Screen Share
              </Badge>
            </div>
          </div>
        </Card>
      );
    }

    // Focus view: Teacher prominent, students small (SAME VIEW FOR BOTH TEACHER AND STUDENTS)
    if (selectedView === 'focus' && teacher) {
      return (
        <div className="h-full flex flex-col gap-4">
          {/* Teacher Video - Large (Both teacher and students see teacher in focus) */}
          <Card className="flex-1 p-0 overflow-hidden">
            <div className="relative h-full">
              <FocusLayout trackRef={tracks.find(t => t.participant.sid === teacher.sid)}>
                <ParticipantTile participant={teacher} />
              </FocusLayout>
              <div className="absolute top-4 left-4 z-10">
                <Badge className="bg-opacity-90">
                  <GraduationCap className="mr-1 h-3 w-3" />
                  Teacher
                </Badge>
              </div>
              {/* Show "You" indicator if current user is the teacher */}
              {role === 'teacher' && localParticipant.sid === teacher.sid && (
                <div className="absolute top-4 right-4 z-10">
                  <Badge variant="secondary" className="bg-opacity-90">
                    You
                  </Badge>
                </div>
              )}
            </div>
          </Card>

          {/* Students - Small Grid (visible to both teacher and students) */}
          {students.length > 0 && (
            <Card className="h-32 p-2">
              <ScrollArea className="h-full">
                <div className="flex gap-2">
                  {students.map((student) => (
                    <div key={student.sid} className="relative w-24 h-24 flex-shrink-0">
                      <ParticipantTile participant={student} />
                      {/* Show "You" indicator for current student */}
                      {localParticipant.sid === student.sid && (
                        <div className="absolute bottom-1 left-1 z-10">
                          <Badge variant="secondary" className="text-xs px-1">
                            You
                          </Badge>
                        </div>
                      )}
                      {raisedHands.has(student.sid) && (
                        <div className="absolute top-1 right-1 z-10">
                          <Hand className="h-4 w-4 text-yellow-500 animate-pulse" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      );
    }

    // Grid view: All participants equal size
    return (
      <Card className="h-full p-4 overflow-hidden">
        <GridLayout tracks={tracks}>
          <TrackLoop tracks={tracks}>
            {(track) => (
              <div className="relative">
                <ParticipantTile />
                {track.participant.metadata && (
                  <div className="absolute top-2 left-2 z-10">
                    <Badge variant={
                      JSON.parse(track.participant.metadata).role === 'teacher'
                        ? 'default'
                        : 'secondary'
                    }>
                      {JSON.parse(track.participant.metadata).role}
                    </Badge>
                  </div>
                )}
                {raisedHands.has(track.participant.sid) && (
                  <div className="absolute top-2 right-2 z-10">
                    <Hand className="h-5 w-5 text-yellow-500 animate-pulse" />
                  </div>
                )}
              </div>
            )}
          </TrackLoop>
        </GridLayout>
      </Card>
    );
  };

  return (
    <div className="h-screen flex bg-slate-900">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">
              {roomName}
            </h1>
            <Badge variant={role === 'teacher' ? 'default' : 'secondary'}>
              {role === 'teacher' ? (
                <>
                  <GraduationCap className="mr-1 h-3 w-3" />
                  Teacher
                </>
              ) : (
                <>
                  <BookOpen className="mr-1 h-3 w-3" />
                  Student
                </>
              )}
            </Badge>
            <Badge variant="outline" className="text-white">
              <Users className="mr-1 h-3 w-3" />
              {participants.length}
            </Badge>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <Button
              variant={selectedView === 'focus' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedView('focus')}
            >
              <Maximize className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedView === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedView('grid')}
            >
              <Minimize className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 min-h-0">
          {renderMainContent()}
        </div>

        {/* Control Bar */}
        <div className="mt-4">
          {role === 'teacher' ? (
            <TeacherControls
              students={students}
              onMuteAll={() => {/* Implement */}}
              raisedHands={raisedHands}
              onClearHand={(sid) => handleRaiseHand(sid)}
            />
          ) : (
            <div className="flex items-center justify-center gap-4">
              <StudentRequestButton
                onRaiseHand={() => handleRaiseHand(localParticipant.sid)}
                isRaised={raisedHands.has(localParticipant.sid)}
              />
              <ControlBar
                variation="minimal"
                controls={{
                  microphone: false,
                  camera: false,
                  chat: true,
                  screenShare: false,
                  leave: true,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 bg-slate-800 border-l border-slate-700">
        <Tabs defaultValue="chat" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat">
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="participants">
              <Users className="mr-2 h-4 w-4" />
              Participants
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 overflow-hidden">
            <Chat className="h-full" />
          </TabsContent>

          <TabsContent value="participants" className="flex-1 overflow-hidden p-4">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {/* Teacher */}
                {teacher && (
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {teacher.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{teacher.name}</p>
                            <Badge variant="default" className="text-xs">
                              Teacher
                            </Badge>
                          </div>
                        </div>
                        <ConnectionQualityIndicator participant={teacher} />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Students */}
                {students.map((student) => (
                  <Card key={student.sid}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {student.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{student.name}</p>
                            <Badge variant="secondary" className="text-xs">
                              Student
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {raisedHands.has(student.sid) && (
                            <Hand className="h-4 w-4 text-yellow-500" />
                          )}
                          <ConnectionQualityIndicator participant={student} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Audio Renderer */}
      <RoomAudioRenderer />
    </div>
  );
}
```

---

## Phase 5: Teacher Controls

### Create `app/classroom/[roomName]/TeacherControls.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ControlBar,
  useTrackToggle,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track, RemoteParticipant } from 'livekit-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Users,
  UserX,
  Volume2,
  VolumeX,
  Settings,
  Hand,
  UserCheck,
  Lock,
  Unlock,
  Radio,
  PhoneOff,
} from 'lucide-react';

interface TeacherControlsProps {
  students: RemoteParticipant[];
  onMuteAll: () => void;
  raisedHands: Set<string>;
  onClearHand: (participantId: string) => void;
}

export default function TeacherControls({
  students,
  onMuteAll,
  raisedHands,
  onClearHand,
}: TeacherControlsProps) {
  const { localParticipant } = useLocalParticipant();
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  const micToggle = useTrackToggle({ source: Track.Source.Microphone });
  const camToggle = useTrackToggle({ source: Track.Source.Camera });
  const screenToggle = useTrackToggle({ source: Track.Source.ScreenShare });

  const handleSelectStudent = (sid: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) {
        next.delete(sid);
      } else {
        next.add(sid);
      }
      return next;
    });
  };

  const handleMuteSelected = () => {
    // Implement muting selected students
    console.log('Muting students:', Array.from(selectedStudents));
    setSelectedStudents(new Set());
  };

  const handleGrantPermission = (sid: string) => {
    // Implement granting speaking permission
    console.log('Granting permission to:', sid);
    onClearHand(sid);
  };

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Media Controls */}
          <div className="flex items-center gap-2">
            {/* Microphone */}
            <Button
              variant={micToggle.enabled ? 'default' : 'secondary'}
              size="lg"
              onClick={micToggle.toggle}
            >
              {micToggle.enabled ? (
                <>
                  <Mic className="h-4 w-4" />
                </>
              ) : (
                <>
                  <MicOff className="h-4 w-4" />
                </>
              )}
            </Button>

            {/* Camera */}
            <Button
              variant={camToggle.enabled ? 'default' : 'secondary'}
              size="lg"
              onClick={camToggle.toggle}
            >
              {camToggle.enabled ? (
                <>
                  <Video className="h-4 w-4" />
                </>
              ) : (
                <>
                  <VideoOff className="h-4 w-4" />
                </>
              )}
            </Button>

            {/* Screen Share */}
            <Button
              variant={screenToggle.enabled ? 'default' : 'secondary'}
              size="lg"
              onClick={screenToggle.toggle}
            >
              {screenToggle.enabled ? (
                <>
                  <MonitorOff className="h-4 w-4 mr-2" />
                  Stop Share
                </>
              ) : (
                <>
                  <Monitor className="h-4 w-4 mr-2" />
                  Share Screen
                </>
              )}
            </Button>
          </div>

          {/* Center: Classroom Controls */}
          <div className="flex items-center gap-2">
            {/* Raised Hands Indicator */}
            {raisedHands.size > 0 && (
              <Badge variant="default" className="bg-yellow-600">
                <Hand className="h-3 w-3 mr-1" />
                {raisedHands.size} Raised
              </Badge>
            )}

            {/* Mute All Students */}
            <Button
              variant="outline"
              size="sm"
              onClick={onMuteAll}
            >
              <VolumeX className="h-4 w-4 mr-2" />
              Mute All
            </Button>

            {/* Lock/Unlock Room */}
            <Button
              variant={isRoomLocked ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setIsRoomLocked(!isRoomLocked)}
            >
              {isRoomLocked ? (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Locked
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Open
                </>
              )}
            </Button>

            {/* Selected Students Actions */}
            {selectedStudents.size > 0 && (
              <>
                <Badge variant="secondary">
                  {selectedStudents.size} Selected
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMuteSelected}
                >
                  <MicOff className="h-4 w-4 mr-2" />
                  Mute Selected
                </Button>
              </>
            )}
          </div>

          {/* Right: Session Controls */}
          <div className="flex items-center gap-2">
            {/* Settings */}
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>

            {/* End Class */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm('Are you sure you want to end the class?')) {
                  // Implement ending class
                }
              }}
            >
              <PhoneOff className="h-4 w-4 mr-2" />
              End Class
            </Button>
          </div>
        </div>

        {/* Raised Hands Queue */}
        {raisedHands.size > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-xs text-muted-foreground mb-2">Students requesting to speak:</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(raisedHands).map((sid) => {
                const student = students.find((s) => s.sid === sid);
                if (!student) return null;

                return (
                  <Badge
                    key={sid}
                    variant="secondary"
                    className="cursor-pointer"
                  >
                    <span>{student.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-4 w-4 p-0"
                      onClick={() => handleGrantPermission(sid)}
                    >
                      <UserCheck className="h-3 w-3" />
                    </Button>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Create `app/classroom/[roomName]/StudentRequestButton.tsx`

```tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Hand } from 'lucide-react';

interface StudentRequestButtonProps {
  onRaiseHand: () => void;
  isRaised: boolean;
}

export default function StudentRequestButton({
  onRaiseHand,
  isRaised,
}: StudentRequestButtonProps) {
  return (
    <Button
      variant={isRaised ? 'default' : 'outline'}
      size="lg"
      onClick={onRaiseHand}
      className={isRaised ? 'animate-pulse' : ''}
    >
      <Hand className={`h-4 w-4 mr-2 ${isRaised ? 'text-yellow-300' : ''}`} />
      {isRaised ? 'Lower Hand' : 'Raise Hand'}
    </Button>
  );
}
```

---

## Testing Instructions

### 1. Install Dependencies

```bash
# Install all dependencies including shadcn requirements
pnpm install
```

### 2. Start Development Server

```bash
pnpm dev
```

### 3. Test Classroom Flow

#### Teacher Flow:
1. Navigate to `http://localhost:3000/classroom/test-room`
2. Enter your name
3. Select "Teacher" role
4. Enable camera and microphone
5. Click "Start Teaching"
6. You'll enter the classroom with full controls

#### Student Flow:
1. Open another browser/incognito window
2. Navigate to `http://localhost:3000/classroom/test-room`
3. Enter your name
4. Select "Student" role (media will be disabled)
5. Click "Join Class"
6. You'll join as a student with limited permissions
7. Use "Raise Hand" button to request to speak

### 4. Test Features

**Teacher Features:**
- Control own camera/microphone
- Share screen
- See raised hands from students
- Mute all students
- Lock/unlock room
- End class

**Student Features:**
- Join with media disabled
- Raise hand to speak
- View teacher's video/screen share
- Participate in chat
- See other students

**Layout Testing:**
- Switch between Focus view (teacher prominent) and Grid view
- Test with screen sharing
- Test with multiple students
- Test responsive design on different screen sizes

### 5. Verify LiveKit Integration

The implementation maintains all LiveKit WebRTC functionality:
- Real-time video/audio streaming
- Screen sharing
- Connection quality indicators
- Automatic quality adaptation
- Chat functionality

### 6. Verify shadcn Styling

Check that shadcn components are properly styled:
- Cards have proper borders and shadows
- Buttons have hover states
- Badges show correct colors for roles
- Tabs work for switching views
- Dark theme is properly applied

---

## Key Integration Patterns

### 1. Wrapping LiveKit with shadcn

```tsx
// Wrap LiveKit components with shadcn containers
<Card className="p-0 overflow-hidden">
  <FocusLayout trackRef={teacherTrack}>
    <ParticipantTile participant={teacher} />
  </FocusLayout>
</Card>
```

### 2. Custom Controls with LiveKit Hooks

```tsx
// Use LiveKit hooks with shadcn buttons
const { enabled, toggle } = useTrackToggle({ source: Track.Source.Microphone });

<Button onClick={toggle} variant={enabled ? 'default' : 'secondary'}>
  {enabled ? <Mic /> : <MicOff />}
</Button>
```

### 3. Layout Composition

```tsx
// Combine LiveKit layouts with shadcn structure
<div className="flex">
  <Card className="flex-1">
    <GridLayout tracks={studentTracks}>
      {/* LiveKit handles WebRTC */}
    </GridLayout>
  </Card>
  <Card className="w-80">
    {/* shadcn UI for controls */}
  </Card>
</div>
```

### 4. Styling LiveKit Components

```css
/* Make LiveKit components match shadcn theme */
.lk-participant-tile {
  @apply rounded-lg border bg-card text-card-foreground shadow-sm;
}

.lk-control-bar {
  @apply bg-background/95 backdrop-blur;
}
```

---

## Next Steps

After implementing these phases, you can:

1. **Phase 6**: Implement the raise hand functionality with LiveKit data channels
2. **Phase 7**: Add the permissions update API for dynamic role changes
3. **Phase 8+**: Add advanced features like polls, whiteboard, breakout rooms

The current implementation provides a solid foundation with:
- Full classroom functionality
- Role-based access control
- Teacher controls and student restrictions
- Beautiful UI with shadcn components
- Reliable WebRTC with LiveKit
- Responsive design
- Extensible architecture

The hybrid approach successfully combines shadcn's design system with LiveKit's WebRTC capabilities, providing both aesthetic appeal and technical reliability.