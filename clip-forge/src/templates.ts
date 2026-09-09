import type { AnimationLayer, Background, PictureLayer, Project, Template, TextLayer } from './types'
import { uid } from './types'

// ---------------------------------------------------------------------------
// Template library. Every template is a complete Project; the editor clones it
// so the user can change anything. Backgrounds are gradients so the templates
// work with zero assets — the user swaps in their own photo / video.
// ---------------------------------------------------------------------------

function bg(gradient: string, extra: Partial<Background> = {}): Background {
  return { kind: 'gradient', gradient, color: '#1d1d2b', dim: 0, kenBurns: true, blur: 0, ...extra }
}

function text(partial: Partial<TextLayer> & { text: string; y: number }): TextLayer {
  return {
    id: uid('t'),
    x: 0.5,
    size: 0.06,
    maxWidth: 0.86,
    color: '#ffffff',
    font: 'sans',
    align: 'center',
    outline: false,
    shadow: true,
    uppercase: false,
    anim: 'rise',
    delay: 0.2,
    ...partial,
  }
}

function anim(partial: Partial<AnimationLayer> & { kind: string }): AnimationLayer {
  return {
    text: 'SALE',
    motion: 'bounce',
    x: 0.5,
    y: 0.5,
    scale: 0.42,
    color: '#ffb400',
    color2: '#ff4d6d',
    delay: 0.15,
    metallic: true,
    enabled: false,
    ...partial,
  }
}

function picture(partial: Partial<PictureLayer> = {}): PictureLayer {
  return {
    isVideo: false,
    autoCutout: true,
    cutoutTolerance: 0.28,
    depth: 0.5,
    device: 'phone',
    motion: 'pop',
    camera: 'orbit',
    x: 0.5,
    y: 0.5,
    scale: 0.44,
    popDistance: 0.55,
    delay: 0.4,
    frameColor: '#1b1b22',
    ...partial,
  }
}

function project(p: Partial<Project> & { name: string; texts: TextLayer[]; animation: AnimationLayer }): Project {
  return {
    format: '9:16',
    duration: 8,
    fps: 30,
    background: bg('sunset'),
    picture: picture(),
    logo: { corner: 'br', size: 0.06 },
    ...p,
  }
}

export const TEMPLATES: Template[] = [
  {
    id: 'flash-sale',
    name: 'Flash Sale',
    category: 'Sales',
    emoji: '🔥',
    project: project({
      name: 'Flash Sale',
      background: bg('ember'),
      texts: [
        text({ text: 'FLASH SALE', y: 0.16, size: 0.085, font: 'impact', uppercase: true, anim: 'pop', delay: 0.1 }),
        text({ text: 'This weekend only', y: 0.24, size: 0.038, color: '#ffe6b3', delay: 0.5 }),
        text({ text: 'Up to 50% off everything in store', y: 0.78, size: 0.045, delay: 0.9 }),
        text({ text: 'SHOP NOW →', y: 0.88, size: 0.04, boxColor: '#ffffff', color: '#b3261e', uppercase: true, anim: 'pop', delay: 1.3 }),
      ],
      picture: picture({ device: 'phone', motion: 'pop', camera: 'orbit', scale: 0.44, y: 0.53 }),
      animation: anim({ enabled: false,  kind: 'text3d', text: '50%\nOFF', motion: 'bounce', y: 0.5, scale: 0.34, color: '#ffd23f', color2: '#ff6b35' }),
    }),
  },
  {
    id: 'open-house',
    name: 'Open House',
    category: 'Real Estate',
    emoji: '🏠',
    project: project({
      name: 'Open House',
      background: bg('sky', { dim: 0.15 }),
      texts: [
        text({ text: 'OPEN HOUSE', y: 0.14, size: 0.08, font: 'impact', uppercase: true, anim: 'slide' }),
        text({ text: 'Saturday 11am – 2pm', y: 0.22, size: 0.04, color: '#dff3ff', delay: 0.5 }),
        text({ text: '24 Maple Drive · 4 bed · 3 bath', y: 0.8, size: 0.04, delay: 0.9 }),
        text({ text: 'Just listed — $749,000', y: 0.88, size: 0.042, boxColor: '#0f9d58', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'frame', motion: 'peel', camera: 'dolly', scale: 0.4, y: 0.5, frameColor: '#6b4226' }),
      animation: anim({ enabled: false,  kind: 'house', motion: 'drop', y: 0.52, scale: 0.4, color: '#ffffff', color2: '#e63946' }),
    }),
  },
  {
    id: 'now-hiring',
    name: "We're Hiring",
    category: 'Announcement',
    emoji: '📣',
    project: project({
      name: "We're Hiring",
      background: bg('ocean'),
      texts: [
        text({ text: "WE'RE HIRING", y: 0.15, size: 0.08, font: 'impact', uppercase: true, anim: 'pop' }),
        text({ text: 'Join a team that ships', y: 0.23, size: 0.038, color: '#c9f0ff', delay: 0.5 }),
        text({ text: 'Senior Designer · Remote · Full time', y: 0.79, size: 0.04, delay: 0.9 }),
        text({ text: 'Apply at yourcompany.com/jobs', y: 0.88, size: 0.036, boxColor: '#ffffff', color: '#0b3d91', delay: 1.2, anim: 'pop' }),
      ],
      picture: picture({ device: 'laptop', motion: 'slideUp', camera: 'orbit', scale: 0.28, y: 0.52 }),
      animation: anim({ enabled: false,  kind: 'megaphone', motion: 'swing', y: 0.5, scale: 0.42, color: '#ff8a00', color2: '#2b2d42' }),
    }),
  },
  {
    id: 'new-menu',
    name: 'New on the Menu',
    category: 'Restaurant',
    emoji: '🍔',
    project: project({
      name: 'New on the Menu',
      background: bg('mango'),
      texts: [
        text({ text: 'NEW ON THE MENU', y: 0.14, size: 0.07, font: 'impact', uppercase: true, anim: 'pop' }),
        text({ text: 'The Double Smash', y: 0.22, size: 0.05, font: 'rounded', color: '#fff3d6', delay: 0.5 }),
        text({ text: 'Two patties, smoked cheddar, secret sauce', y: 0.79, size: 0.038, delay: 0.9 }),
        text({ text: 'Order now · $12.90', y: 0.88, size: 0.042, boxColor: '#2b1b12', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'polaroid', motion: 'pop', camera: 'handheld', scale: 0.4, y: 0.48 }),
      animation: anim({ enabled: false,  kind: 'burger', motion: 'drop', y: 0.5, scale: 0.4, color: '#d98e3d', color2: '#5a9c3a', metallic: false }),
    }),
  },
  {
    id: 'launch',
    name: 'Product Launch',
    category: 'Announcement',
    emoji: '🚀',
    project: project({
      name: 'Product Launch',
      background: bg('midnight'),
      texts: [
        text({ text: 'LAUNCHING NOW', y: 0.15, size: 0.075, font: 'impact', uppercase: true, anim: 'slide' }),
        text({ text: 'Version 2.0 is here', y: 0.23, size: 0.04, color: '#b8c0ff', delay: 0.5 }),
        text({ text: 'Faster. Smarter. Yours.', y: 0.79, size: 0.05, font: 'rounded', delay: 0.9 }),
        text({ text: 'Try it free', y: 0.88, size: 0.04, boxColor: '#7c5cff', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'phone', motion: 'zoom', camera: 'dolly', scale: 0.44, y: 0.53, popDistance: 0.75 }),
      animation: anim({ enabled: false,  kind: 'rocket', motion: 'float', y: 0.5, scale: 0.46, color: '#ffffff', color2: '#ff5d73' }),
    }),
  },
  {
    id: 'event',
    name: 'Event Invite',
    category: 'Events',
    emoji: '🎉',
    project: project({
      name: 'Event Invite',
      background: bg('candy'),
      texts: [
        text({ text: "YOU'RE INVITED", y: 0.14, size: 0.075, font: 'impact', uppercase: true, anim: 'pop' }),
        text({ text: 'Summer Launch Party', y: 0.22, size: 0.045, color: '#ffe3f1', delay: 0.5 }),
        text({ text: 'Friday 7pm · The Rooftop, 5th Ave', y: 0.79, size: 0.038, delay: 0.9 }),
        text({ text: 'RSVP today', y: 0.88, size: 0.04, boxColor: '#ffffff', color: '#c2185b', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'billboard', motion: 'pop', camera: 'orbit', scale: 0.24, y: 0.5, frameColor: '#2b2d42' }),
      animation: anim({ enabled: true, kind: 'confetti', motion: 'pop', y: 0.42, scale: 0.7, delay: 1.6, color: '#ffd23f', color2: '#4cc9f0' }),
    }),
  },
  {
    id: 'five-star',
    name: '5-Star Review',
    category: 'Social Proof',
    emoji: '⭐',
    project: project({
      name: '5-Star Review',
      background: bg('forest', { dim: 0.1 }),
      texts: [
        text({ text: '★★★★★', y: 0.15, size: 0.07, color: '#ffd23f', anim: 'pop' }),
        text({ text: '“Best service I have ever had. They went above and beyond.”', y: 0.76, size: 0.042, font: 'serif', delay: 0.8, maxWidth: 0.8 }),
        text({ text: '— Jamie R., verified customer', y: 0.87, size: 0.032, color: '#d5f5e3', delay: 1.2 }),
      ],
      picture: picture({ device: 'tablet', motion: 'flip', camera: 'orbit', scale: 0.42, y: 0.5, frameColor: '#e9e9ee' }),
      animation: anim({ enabled: true, kind: 'star', motion: 'spinIn', x: 0.82, y: 0.3, scale: 0.15, delay: 1.8, color: '#ffd23f', color2: '#ff9f1c' }),
    }),
  },
  {
    id: 'grand-opening',
    name: 'Grand Opening',
    category: 'Sales',
    emoji: '🎁',
    project: project({
      name: 'Grand Opening',
      background: bg('royal'),
      texts: [
        text({ text: 'GRAND OPENING', y: 0.14, size: 0.078, font: 'impact', uppercase: true, anim: 'pop' }),
        text({ text: 'Free gift for the first 100 visitors', y: 0.23, size: 0.038, color: '#e0d4ff', delay: 0.5 }),
        text({ text: 'Doors open Saturday 9am', y: 0.79, size: 0.045, delay: 0.9 }),
        text({ text: '123 Market Street', y: 0.88, size: 0.036, boxColor: '#ffffff', color: '#3d1c8f', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'tv', motion: 'pop', camera: 'dolly', scale: 0.26, y: 0.52 }),
      animation: anim({ enabled: false,  kind: 'gift', motion: 'drop', y: 0.5, scale: 0.4, color: '#ff4d6d', color2: '#ffd23f' }),
    }),
  },
  {
    id: 'cashback',
    name: 'Cashback Offer',
    category: 'Finance',
    emoji: '🪙',
    project: project({
      name: 'Cashback Offer',
      background: bg('emerald'),
      texts: [
        text({ text: 'GET 10% CASHBACK', y: 0.14, size: 0.07, font: 'impact', uppercase: true, anim: 'slide' }),
        text({ text: 'On every purchase, every day', y: 0.22, size: 0.038, color: '#d8ffe8', delay: 0.5 }),
        text({ text: 'No fees. No minimum spend.', y: 0.79, size: 0.042, delay: 0.9 }),
        text({ text: 'Open an account in 2 minutes', y: 0.88, size: 0.036, boxColor: '#ffd23f', color: '#0b3b25', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'phone', motion: 'slideUp', camera: 'orbit', scale: 0.42, y: 0.55 }),
      animation: anim({ enabled: true, kind: 'coin', text: '$', motion: 'orbit', x: 0.8, y: 0.68, scale: 0.15, delay: 1.8, color: '#ffd23f', color2: '#d99a00' }),
    }),
  },
  {
    id: 'gym',
    name: 'Fitness Challenge',
    category: 'Fitness',
    emoji: '⚡',
    project: project({
      name: 'Fitness Challenge',
      background: bg('volt'),
      texts: [
        text({ text: '30-DAY CHALLENGE', y: 0.14, size: 0.072, font: 'impact', uppercase: true, anim: 'pop' }),
        text({ text: 'Starts Monday', y: 0.22, size: 0.04, color: '#e9ff70', delay: 0.5 }),
        text({ text: 'Unlimited classes · Coaching · Community', y: 0.79, size: 0.036, delay: 0.9 }),
        text({ text: 'First week free', y: 0.88, size: 0.042, boxColor: '#e9ff70', color: '#111111', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'portal', motion: 'zoom', camera: 'handheld', scale: 0.4, y: 0.5, popDistance: 0.75 }),
      animation: anim({ enabled: true, kind: 'bolt', motion: 'pop', x: 0.83, y: 0.3, scale: 0.15, delay: 1.8, color: '#e9ff70', color2: '#111111' }),
    }),
  },
  {
    id: 'coming-soon',
    name: 'Coming Soon',
    category: 'Announcement',
    emoji: '💎',
    project: project({
      name: 'Coming Soon',
      background: bg('midnight'),
      texts: [
        text({ text: 'COMING SOON', y: 0.15, size: 0.08, font: 'impact', uppercase: true, anim: 'fade' }),
        text({ text: 'Something brilliant is on its way', y: 0.79, size: 0.042, font: 'serif', delay: 0.9 }),
        text({ text: 'Join the waitlist', y: 0.88, size: 0.04, boxColor: '#ffffff', color: '#1b1b3a', anim: 'pop', delay: 1.3 }),
      ],
      picture: picture({ device: 'monitor', motion: 'flip', camera: 'orbit', scale: 0.27, y: 0.5 }),
      animation: anim({ enabled: true, kind: 'diamond', motion: 'orbit', x: 0.8, y: 0.3, scale: 0.14, delay: 1.8, color: '#7ef9ff', color2: '#b388ff' }),
    }),
  },
  {
    id: 'love-local',
    name: 'Thank You',
    category: 'Social Proof',
    emoji: '💖',
    project: project({
      name: 'Thank You',
      background: bg('rose'),
      texts: [
        text({ text: 'THANK YOU', y: 0.15, size: 0.085, font: 'impact', uppercase: true, anim: 'pop' }),
        text({ text: '10,000 happy customers', y: 0.23, size: 0.04, color: '#ffe0ea', delay: 0.5 }),
        text({ text: 'We could not have done it without you', y: 0.8, size: 0.04, delay: 0.9 }),
        text({ text: '@yourbrand', y: 0.88, size: 0.036, boxColor: '#ffffff', color: '#c2185b', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'polaroid', motion: 'peel', camera: 'handheld', scale: 0.4, y: 0.48 }),
      animation: anim({ enabled: true, kind: 'heart', motion: 'bounce', x: 0.8, y: 0.3, scale: 0.14, delay: 1.8, color: '#ff4d6d', color2: '#ff8fa3' }),
    }),
  },
  {
    id: 'visit-us',
    name: 'Visit Us',
    category: 'Local Business',
    emoji: '📍',
    project: project({
      name: 'Visit Us',
      background: bg('sunset'),
      texts: [
        text({ text: 'NOW OPEN', y: 0.15, size: 0.085, font: 'impact', uppercase: true, anim: 'pop' }),
        text({ text: 'Your new neighbourhood favourite', y: 0.23, size: 0.038, delay: 0.5 }),
        text({ text: 'Mon – Sat · 8am to 6pm', y: 0.79, size: 0.042, delay: 0.9 }),
        text({ text: '88 High Street', y: 0.88, size: 0.04, boxColor: '#ffffff', color: '#b3261e', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'frame', motion: 'pop', camera: 'dolly', scale: 0.4, y: 0.5, frameColor: '#f2efe8' }),
      animation: anim({ enabled: false,  kind: 'pin', motion: 'drop', y: 0.5, scale: 0.42, color: '#ff4d6d', color2: '#ffffff' }),
    }),
  },
  {
    id: 'shop-drop',
    name: 'New Drop',
    category: 'Sales',
    emoji: '🛍️',
    project: project({
      name: 'New Drop',
      background: bg('candy'),
      texts: [
        text({ text: 'NEW DROP', y: 0.15, size: 0.09, font: 'impact', uppercase: true, anim: 'slide' }),
        text({ text: 'Autumn collection · Limited run', y: 0.23, size: 0.036, delay: 0.5 }),
        text({ text: 'Free shipping over $50', y: 0.79, size: 0.042, delay: 0.9 }),
        text({ text: 'Shop the drop', y: 0.88, size: 0.04, boxColor: '#111111', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'phone', motion: 'flip', camera: 'orbit', scale: 0.44, y: 0.53, frameColor: '#f4f4f8' }),
      animation: anim({ enabled: false,  kind: 'bag', motion: 'swing', y: 0.5, scale: 0.42, color: '#ffffff', color2: '#ff4d6d' }),
    }),
  },
  {
    id: 'mascot-hello',
    name: 'Say Hello',
    category: 'Social',
    emoji: '👋',
    project: project({
      name: 'Say Hello',
      background: bg('sky'),
      texts: [
        text({ text: 'HELLO THERE!', y: 0.15, size: 0.08, font: 'rounded', uppercase: true, anim: 'pop' }),
        text({ text: 'Follow us for weekly tips & deals', y: 0.79, size: 0.042, delay: 0.9 }),
        text({ text: '@yourbrand', y: 0.88, size: 0.04, boxColor: '#ffffff', color: '#0b3d91', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'tablet', motion: 'pop', camera: 'orbit', scale: 0.4, y: 0.5 }),
      animation: anim({ enabled: true, kind: 'mascot', motion: 'bounce', x: 0.8, y: 0.7, scale: 0.2, delay: 1.8, color: '#7c5cff', color2: '#ffd23f', metallic: false }),
    }),
  },
  {
    id: 'done',
    name: 'Booked Out',
    category: 'Social Proof',
    emoji: '✅',
    project: project({
      name: 'Booked Out',
      background: bg('emerald'),
      texts: [
        text({ text: 'SOLD OUT', y: 0.15, size: 0.09, font: 'impact', uppercase: true, anim: 'pop' }),
        text({ text: 'Thank you — next batch drops Friday', y: 0.8, size: 0.042, delay: 0.9 }),
        text({ text: 'Get notified', y: 0.88, size: 0.04, boxColor: '#ffffff', color: '#0b3b25', anim: 'pop', delay: 1.2 }),
      ],
      picture: picture({ device: 'tv', motion: 'slideUp', camera: 'still', scale: 0.26, y: 0.54 }),
      animation: anim({ enabled: true, kind: 'check', motion: 'pop', x: 0.8, y: 0.3, scale: 0.14, delay: 1.8, color: '#4ade80', color2: '#ffffff' }),
    }),
  },
  {
    id: 'blank',
    name: 'Start from scratch',
    category: 'Blank',
    emoji: '✨',
    project: project({
      name: 'Untitled clip',
      background: bg('midnight'),
      texts: [text({ text: 'Your headline here', y: 0.15, size: 0.07, font: 'impact', uppercase: true, anim: 'pop' })],
      picture: picture({ device: 'phone', motion: 'pop', camera: 'orbit', scale: 0.44, y: 0.53 }),
      animation: anim({ enabled: false,  kind: 'text3d', text: 'WOW', motion: 'bounce', y: 0.5, scale: 0.3 }),
    }),
  },
]

export const CATEGORIES = ['All', ...Array.from(new Set(TEMPLATES.map((t) => t.category)))]

/** Deep-clone a template project with fresh layer ids. */
export function instantiate(t: Template): Project {
  const p: Project = JSON.parse(JSON.stringify(t.project))
  p.texts = p.texts.map((l) => ({ ...l, id: uid('t') }))
  return p
}
