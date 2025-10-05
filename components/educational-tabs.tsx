"use client"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { BookOpen, Code, Lightbulb, Rocket, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  {
    id: "fundamentals",
    label: "Fundamentals",
    icon: BookOpen,
    title: "Core Fundamentals",
    description: "Master the essential building blocks of modern development",
    content: [
      "Understanding data structures and algorithms",
      "Object-oriented programming principles",
      "Functional programming concepts",
      "Design patterns and best practices",
    ],
  },
  {
    id: "web-dev",
    label: "Web Development",
    icon: Code,
    title: "Web Development",
    description: "Build modern, responsive web applications",
    content: [
      "HTML5, CSS3, and modern JavaScript",
      "React, Next.js, and component architecture",
      "State management and data fetching",
      "Performance optimization techniques",
    ],
  },
  {
    id: "problem-solving",
    label: "Problem Solving",
    icon: Lightbulb,
    title: "Problem Solving",
    description: "Develop critical thinking and analytical skills",
    content: [
      "Breaking down complex problems",
      "Algorithm design and optimization",
      "Debugging strategies and techniques",
      "Code review and refactoring",
    ],
  },
  {
    id: "deployment",
    label: "Deployment",
    icon: Rocket,
    title: "Deployment & DevOps",
    description: "Ship your applications to production",
    content: [
      "CI/CD pipelines and automation",
      "Cloud platforms and serverless",
      "Monitoring and error tracking",
      "Security and performance best practices",
    ],
  },
  {
    id: "career",
    label: "Career Growth",
    icon: GraduationCap,
    title: "Career Development",
    description: "Advance your professional journey",
    content: [
      "Building a strong portfolio",
      "Technical interview preparation",
      "Networking and personal branding",
      "Continuous learning strategies",
    ],
  },
]

export function EducationalTabs() {
  const [activeTab, setActiveTab] = useState(tabs[0].id)
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, left: 0, width: 0 })
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})

  useEffect(() => {
    const activeButton = tabRefs.current[activeTab]
    if (activeButton) {
      const { offsetTop, offsetHeight, offsetLeft, offsetWidth } = activeButton
      setIndicatorStyle({
        top: offsetTop,
        height: offsetHeight,
        left: offsetLeft,
        width: offsetWidth,
      })
    }
  }, [activeTab])

  const activeTabData = tabs.find((tab) => tab.id === activeTab) || tabs[0]

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]">
      {/* Vertical Tab List - Horizontal on mobile */}
      <div className="overflow-x-auto md:overflow-x-visible">
        <div className="relative flex gap-2 md:flex-col">
          <div
            className="absolute rounded-lg bg-primary transition-all duration-300 ease-out md:left-0"
            style={{
              top: `${indicatorStyle.top}px`,
              height: `${indicatorStyle.height}px`,
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
            }}
          />

          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el
                }}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative z-10 flex min-w-[140px] items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-200 md:min-w-0 md:w-full",
                  isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0 transition-transform duration-300", isActive && "scale-110")} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <Card className="overflow-hidden">
        <div key={activeTab} className="animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {activeTabData.title}
              </h2>
              <p className="mt-2 text-pretty text-muted-foreground">{activeTabData.description}</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">What you'll learn</h3>
              <ul className="space-y-3">
                {activeTabData.content.map((item, index) => (
                  <li
                    key={index}
                    className="animate-in fade-in slide-in-from-left-2 flex items-start gap-3"
                    style={{
                      animationDelay: `${index * 100}ms`,
                      animationFillMode: "backwards",
                    }}
                  >
                    <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95">
                Start Learning
              </button>
              <button className="rounded-lg border border-border bg-background px-6 py-2.5 text-sm font-medium text-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground">
                View Curriculum
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
