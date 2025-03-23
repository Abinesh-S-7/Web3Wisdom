# Web3Wisdom: Decentralized Learning Platform

## About the Project

Web3Wisdom is a comprehensive blockchain education platform that bridges the gap between theory and practice in the Web3 space. The platform offers interactive courses on blockchain fundamentals, Web3 development, smart contracts, and DeFi/NFTs, complemented by engaging brain games like Sudoku, Memory, Puzzles, and Quizzes that reinforce learning concepts.

Key features include:
- **Crypto Integration**: Connect your Ethereum wallet to purchase courses with ETH
- **Course Management**: Buy, access, and track progress through various blockchain-related courses
- **Refund System**: Request refunds upon 100% course completion with automatic admin approval
- **Merchandise Store**: Access exclusive educational resources and branded merchandise
- **User Authentication**: Secure multi-method login with wallet connection capabilities
- **Interactive Learning**: Brain games and quizzes to reinforce blockchain concepts

Web3Wisdom makes blockchain education accessible through a practical, engaging approach that rewards learning achievements while building real-world crypto skills.

## Vision

Web3Wisdom aims to democratize blockchain education by creating an ecosystem where users don't just learn about blockchain—they actively use it. Our vision is to:

1. **Lower Barriers to Entry**: Make Web3 concepts accessible to everyone regardless of technical background
2. **Bridge Theory and Practice**: Provide hands-on experience with cryptocurrency transactions as part of the learning journey
3. **Build Community**: Foster a community of blockchain enthusiasts who can learn, share, and grow together
4. **Reward Learning**: Implement innovative incentive mechanisms that reward educational achievements
5. **Enable Real-World Application**: Prepare users for actual participation in the decentralized economy

We believe education is the foundation of Web3 adoption, and by making learning interactive, practical, and rewarding, we can accelerate the transition to a more decentralized future.

## Technical Implementation

Web3Wisdom is built using modern web technologies:
- Next.js, TypeScript, React for the frontend
- Tailwind CSS and Framer Motion for styling and animations
- Ethers.js for Ethereum wallet integration
- Prisma with PostgreSQL for database management
- NextAuth for authentication

## Contract Address

Web3Wisdom uses direct wallet-to-wallet transactions for course purchases and refunds rather than custom smart contracts. The platform's admin wallet address that processes all transactions is:

```
0xfa29ea99B3FcaB327D87053D59a283093Add9041
```

For refunds, the platform implements a verification system that checks course completion status (100%) before processing the return of funds from the admin wallet to the student wallet.

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables for database and authentication
4. Run the development server: `npm run dev`
5. Connect your Ethereum wallet to purchase courses and interact with the platform

## Future Enhancements

- NFT certificates for course completion
- DAO governance for course creation and curation
- Integration with multiple blockchains beyond Ethereum
- Specialized learning paths for different Web3 career tracks
- Peer-to-peer learning marketplace

---

*Web3Wisdom: Transforming blockchain education through interactive courses, crypto integration, and hands-on learning—where knowledge meets real-world application in the decentralized economy.*
