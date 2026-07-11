export type PoliticalLeaning = 'Right' | 'Left' | 'Center' | 'Moderate' | 'Undecided';

export interface UserProfile {
  uid: string;
  displayName: string;
  bio: string;
  leaning: PoliticalLeaning;
  interests: string[];
  supportCount?: number;
  supporters?: string[];
  happyToChat?: boolean;
  hasConnectedSocial?: boolean;
  warningStatus?: 'none' | 'whistle' | 'yellow' | 'red';
  bridgeBuilderPoints?: number;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface Debate {
  id: string;
  topic: string;
  creatorId: string;
  status: 'open' | 'active' | 'closed';
  participants: string[];
  commonGrounds?: string[];
  commonGroundExplanation?: string;
  createdAt: any;
  tags?: string[];
}

export interface DebateArgument {
  id: string;
  debateId: string;
  authorId: string;
  authorName: string;
  authorLeaning: string;
  content: string;
  type: 'argument' | 'counter';
  createdAt: any;
  upvotedBy?: string[];
}
