// Map defaults
export const SEATTLE_CENTER = [47.608, -122.335];
export const SEATTLE_ZOOM = 12;
export const SEATTLE_BOUNDS = {
  south: 47.49,
  west: -122.44,
  north: 47.74,
  east: -122.24,
};

// Buffer distances (meters)
export const BUFFER_INNER_M = 400;  // ~5-min walk
export const BUFFER_OUTER_M = 1200; // ~15-min walk

// Resource categories — each has a label, icon emoji, and list of resources
export const RESOURCE_CATEGORIES = {
  transit: {
    label: 'Transit',
    icon: '\u{1F68C}',
    resources: ['bus_stop', 'light_rail'],
  },
  food: {
    label: 'Food Access',
    icon: '\u{1F34E}',
    resources: ['food_bank', 'grocery'],
  },
  education: {
    label: 'Education',
    icon: '\u{1F4DA}',
    resources: ['school', 'library'],
  },
  health: {
    label: 'Health',
    icon: '\u{1FA7A}',
    resources: ['hospital', 'pharmacy'],
  },
  community: {
    label: 'Community',
    icon: '\u{1F3DB}',
    resources: ['community_center'],
  },
  daily: {
    label: 'Daily Needs',
    icon: '\u{1F9FA}',
    resources: ['laundromat'],
  },
};

// Points at which adding more of a resource type no longer improves the score
export const SATURATION_POINTS = {
  bus_stop: 4,
  light_rail: 1,
  food_bank: 2,
  grocery: 2,
  school: 2,
  hospital: 1,
  library: 1,
  community_center: 1,
  laundromat: 1,
  pharmacy: 1,
};

// Default priority levels per category
export const DEFAULT_PRIORITIES = {
  transit: 'high',
  food: 'high',
  education: 'medium',
  health: 'medium',
  community: 'low',
  daily: 'low',
};

// Numeric multipliers for priority levels
export const PRIORITY_MULTIPLIERS = {
  high: 3,
  medium: 2,
  low: 1,
};

// Score thresholds and their display colors/labels
export const SCORE_COLORS = {
  great: { min: 75, color: '#22c55e', label: 'Great Location' },
  okay: { min: 50, color: '#eab308', label: 'Okay Location' },
  limited: { min: 0, color: '#ef4444', label: 'Limited Resources' },
};
