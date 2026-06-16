const courses = [
  {
    slug: "biblical-foundations",
    title: "Biblical Foundations",
    image: "/images/event1.jpg",
    description:
      "Essential doctrines every believer should know. Learn about salvation, the nature of God, and the authority of Scripture.",
    duration: "4 weeks",
    lessons: "12 lessons",
    students: "245",
    rating: "4.8",
    instructor: "Pastor John Doe",
    progress: 65,
    enrolled: true,
    completed: false,
    price: null,
    buttonText: "Continue Learning",
    buttonClass: "bg-[#08C443] hover:opacity-95"
  },
  {
    slug: "prayer-and-intercession",
    title: "Prayer & Intercession",
    image: "/images/hero2.jpg",
    description:
      "Develop a powerful prayer life. Learn different types of prayer, intercession principles, and how to pray effectively.",
    duration: "3 weeks",
    lessons: "9 lessons",
    students: "189",
    rating: "4.9",
    instructor: "Rev. Jane Smith",
    progress: null,
    enrolled: false,
    completed: false,
    price: "₦2,500",
    buttonText: "Purchase Course",
    buttonClass: "bg-[#4F46E5] hover:bg-indigo-700"
  },
  {
    slug: "evangelism-essentials",
    title: "Evangelism Essentials",
    image: "/images/event3.jpg",
    description:
      "Learn how to effectively share your faith. Practical training in personal evangelism, outreach, and discipleship follow-up.",
    duration: "5 weeks",
    lessons: "15 lessons",
    students: "312",
    rating: "4.7",
    instructor: "Evangelist Mark Johnson",
    progress: null,
    enrolled: false,
    completed: false,
    price: "₦4,000",
    buttonText: "Purchase Course",
    buttonClass: "bg-[#4F46E5] hover:bg-indigo-700"
  },
  {
    slug: "spiritual-disciplines",
    title: "Spiritual Disciplines",
    image: "/images/mission.jpg",
    description:
      "Master the practices that deepen your relationship with God. Study meditation, fasting, solitude, and consistent devotion.",
    duration: "6 weeks",
    lessons: "18 lessons",
    students: "156",
    rating: "4.9",
    instructor: "Dr. Sarah Williams",
    progress: 20,
    enrolled: true,
    completed: false,
    price: null,
    buttonText: "Continue Learning",
    buttonClass: "bg-[#08C443] hover:opacity-95"
  },
  {
    slug: "leadership-development",
    title: "Leadership Development",
    image: "/images/event2.jpg",
    description:
      "Biblical principles for effective Christian leadership. Character development, team building, and servant leadership for ministry.",
    duration: "8 weeks",
    lessons: "24 lessons",
    students: "278",
    rating: "4.8",
    instructor: "Bishop David Brown",
    progress: null,
    enrolled: false,
    completed: false,
    price: "₦5,000",
    buttonText: "Purchase Course",
    buttonClass: "bg-[#4F46E5] hover:bg-indigo-700"
  },
  {
    slug: "understanding-the-holy-spirit",
    title: "Understanding the Holy Spirit",
    image: "/images/hero1.jpg",
    description:
      "Comprehensive study on the person and work of the Holy Spirit. Gifts, fruit, and living a Spirit-filled life.",
    duration: "5 weeks",
    lessons: "15 lessons",
    students: "423",
    rating: "4.9",
    instructor: "Prophet Emmanuel Cole",
    progress: null,
    enrolled: false,
    completed: false,
    price: "₦4,500",
    buttonText: "Purchase Course",
    buttonClass: "bg-[#4F46E5] hover:bg-indigo-700"
  },
  {
    slug: "christian-character-and-growth",
    title: "Christian Character & Growth",
    image: "/images/event3.jpg",
    description:
      "A practical course on godly character, integrity, humility, service, and Christ-like maturity in daily life.",
    duration: "4 weeks",
    lessons: "11 lessons",
    students: "198",
    rating: "4.8",
    instructor: "Pastor Ruth Daniel",
    progress: 100,
    enrolled: true,
    completed: true,
    price: null,
    buttonText: "Completed",
    buttonClass: "bg-slate-700 hover:bg-slate-800"
  },
  {
    slug: "foundations-of-discipleship",
    title: "Foundations of Discipleship",
    image: "/images/mission.jpg",
    description:
      "Learn what it means to follow Jesus faithfully through obedience, spiritual habits, and biblical worldview formation.",
    duration: "5 weeks",
    lessons: "13 lessons",
    students: "221",
    rating: "4.7",
    instructor: "Bro. Samuel Adeyemi",
    progress: 100,
    enrolled: true,
    completed: true,
    price: null,
    buttonText: "Completed",
    buttonClass: "bg-slate-700 hover:bg-slate-800"
  }
];

module.exports = courses;