import { UserProfile, Debate, DebateArgument } from './types';

export const MOCK_USERS: UserProfile[] = [
  {
    uid: 'mock1',
    displayName: 'איתי כהן',
    bio: 'אוהב ארץ ישראל, מאמין בשיח מכבד ובפתרונות יצירתיים לכלכלה.',
    leaning: 'Right',
    interests: ['כלכלה', 'ביטחון'],
    supportCount: 154,
    bridgeBuilderPoints: 45,
    createdAt: { seconds: 123, nanoseconds: 0 },
    updatedAt: { seconds: 123, nanoseconds: 0 }
  },
  {
    uid: 'mock2',
    displayName: 'Maya Levy',
    bio: 'Social activist, believer in equality and environmental justice.',
    leaning: 'Left',
    interests: ['חברה', 'סביבה'],
    supportCount: 231,
    bridgeBuilderPoints: 60,
    createdAt: { seconds: 124, nanoseconds: 0 },
    updatedAt: { seconds: 124, nanoseconds: 0 }
  },
  {
    uid: 'mock3',
    displayName: 'יוסף אע׳באריה',
    bio: 'פעיל חברתי, רוצה לראות את כולם חיים בכבוד ושוויון.',
    leaning: 'Moderate',
    interests: ['חברה', 'חינוך'],
    supportCount: 89,
    bridgeBuilderPoints: 30,
    createdAt: { seconds: 125, nanoseconds: 0 },
    updatedAt: { seconds: 125, nanoseconds: 0 }
  },
  {
    uid: 'mock4',
    displayName: 'Sara Stern',
    bio: 'Educator and historian. Searching for the roots of our connection.',
    leaning: 'Moderate',
    interests: ['חינוך', 'יחסי דת ומדינה'],
    supportCount: 112,
    bridgeBuilderPoints: 35,
    createdAt: { seconds: 126, nanoseconds: 0 },
    updatedAt: { seconds: 126, nanoseconds: 0 }
  },
  {
    uid: 'mock5',
    displayName: 'דניאל אברהם',
    bio: 'בונה גשרים בין קהילות. מאמין שהכל מתחיל בהקשבה.',
    leaning: 'Center',
    interests: ['חברה', 'משפט ודמוקרטיה'],
    supportCount: 342,
    bridgeBuilderPoints: 120,
    createdAt: { seconds: 127, nanoseconds: 0 },
    updatedAt: { seconds: 127, nanoseconds: 0 }
  },
  {
    uid: 'mock6',
    displayName: 'Ahmed Mansour',
    bio: 'Lawyer and philosopher. Peace is a process, not a destination.',
    leaning: 'Left',
    interests: ['משפט ודמוקרטיה', 'ביטחון'],
    supportCount: 167,
    bridgeBuilderPoints: 50,
    createdAt: { seconds: 128, nanoseconds: 0 },
    updatedAt: { seconds: 128, nanoseconds: 0 }
  },
  {
    uid: 'mock7',
    displayName: 'מיכל רז',
    bio: 'כלכלנית עם לב חברתי. מאמינה בשוק חופשי עם רשת ביטחון.',
    leaning: 'Right',
    interests: ['כלכלה', 'דיור'],
    supportCount: 95,
    bridgeBuilderPoints: 25,
    createdAt: { seconds: 129, nanoseconds: 0 },
    updatedAt: { seconds: 129, nanoseconds: 0 }
  },
  {
    uid: 'mock8',
    displayName: 'Yael Weiss',
    bio: 'Artist and creative thinker. Let\'s paint a better future together.',
    leaning: 'Left',
    interests: ['סביבה', 'חברה'],
    supportCount: 128,
    bridgeBuilderPoints: 40,
    createdAt: { seconds: 130, nanoseconds: 0 },
    updatedAt: { seconds: 130, nanoseconds: 0 }
  },
  {
    uid: 'mock9',
    displayName: 'גדי מזרחי',
    bio: 'עובד סוציאלי. רואה את האדם מאחורי הדעה.',
    leaning: 'Moderate',
    interests: ['בריאות', 'חברה'],
    supportCount: 215,
    bridgeBuilderPoints: 75,
    createdAt: { seconds: 131, nanoseconds: 0 },
    updatedAt: { seconds: 131, nanoseconds: 0 }
  },
  {
    uid: 'mock10',
    displayName: 'Rivka Goldberg',
    bio: 'Tech entrepreneur. Optimizing for a better society.',
    leaning: 'Center',
    interests: ['כלכלה', 'תחבורה'],
    supportCount: 76,
    bridgeBuilderPoints: 20,
    createdAt: { seconds: 132, nanoseconds: 0 },
    updatedAt: { seconds: 132, nanoseconds: 0 }
  }
];

export const MOCK_DEBATES: Debate[] = [
  {
    id: 'debate1',
    topic: 'האם הרפורמה המשפטית תחזק או תחליש את הדמוקרטיה?',
    creatorId: 'mock5',
    status: 'active',
    participants: ['mock5', 'mock2', 'mock6', 'mock1'],
    commonGrounds: ['הצורך ביציבות שלטונית', 'חשיבות ההגנה על זכויות הפרט'],
    createdAt: { seconds: 100, nanoseconds: 0 },
    tags: ['משפט ודמוקרטיה', 'חברה']
  },
  {
    id: 'debate2',
    topic: 'The impact of climate change policies on the economy',
    creatorId: 'mock8',
    status: 'active',
    participants: ['mock8', 'mock7', 'mock10'],
    commonGrounds: ['Innovation is key to sustainability', 'Clean air benefits everyone'],
    createdAt: { seconds: 101, nanoseconds: 0 },
    tags: ['סביבה', 'כלכלה']
  },
  {
    id: 'debate3',
    topic: 'גיוס לכולם - האם זה אפשרי בחברה הישראלית?',
    creatorId: 'mock1',
    status: 'active',
    participants: ['mock1', 'mock4', 'mock3', 'mock9'],
    commonGrounds: ['הוקרה למי שנותן למדינה', 'צורך בשוויון בנטל הכלכלי'],
    createdAt: { seconds: 102, nanoseconds: 0 },
    tags: ['ביטחון', 'חברה']
  }
];

export const MOCK_ARGUMENTS: Record<string, DebateArgument[]> = {
  debate1: [
    {
      id: 'arg1',
      debateId: 'debate1',
      authorId: 'mock1',
      authorName: 'איתי כהן',
      authorLeaning: 'Right',
      content: 'המערכת כרגע אינה מאוזנת מספיק. חייבים להחזיר את הכוח לנבחרי הציבור.',
      type: 'argument',
      createdAt: { seconds: 200, nanoseconds: 0 }
    },
    {
      id: 'arg2',
      debateId: 'debate1',
      authorId: 'mock2',
      authorName: 'Levy Maya',
      authorLeaning: 'Left',
      content: 'עצמאות בית המשפט היא הקו האחרון שמגן על מיעוטים. אם היא תעלם, הדמוקרטיה בסכנה.',
      type: 'argument',
      createdAt: { seconds: 201, nanoseconds: 0 }
    },
    {
      id: 'arg3',
      debateId: 'debate1',
      authorId: 'mock5',
      authorName: 'דניאל אברהם',
      authorLeaning: 'Center',
      content: 'אולי אפשר להסכים שדרוש תיקון, אבל הוא חייב להיעשות בהסכמה רחבה כדי לא לקרוע את העם?',
      type: 'argument',
      createdAt: { seconds: 202, nanoseconds: 0 }
    }
  ]
};
