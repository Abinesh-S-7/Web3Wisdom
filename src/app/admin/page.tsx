"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { ethers } from "ethers"
import { Button } from "@/components/ui/button"
import { toast } from "react-toastify"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [walletAddress, setWalletAddress] = useState("")
  const [pendingRefunds, setPendingRefunds] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      // Redirect to home if not logged in
      router.push("/")
    } else {
      // Fetch pending refunds
      fetchPendingRefunds()
    }
  }, [session, router])

  useEffect(() => {
    // Check if wallet is already connected
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0])
        }
      }).catch((err: any) => {
        console.error("Error checking connected accounts:", err)
      })
    }
  }, [])

  const fetchPendingRefunds = async () => {
    setIsLoading(true)
    try {
      // In a real implementation, this would fetch actual pending refunds from a database
      // For demo purposes, we'll use mock data
      setPendingRefunds([
        {
          id: "1",
          userId: "user1",
          userName: "Test User",
          courseTitle: "Blockchain Development",
          walletAddress: "0xbF188D68de8f9C232cC421dF11aa16d06b506BD1",
          requestDate: new Date().toISOString(),
          amount: "0.03"
        }
      ])
    } catch (error) {
      console.error("Error fetching pending refunds:", error)
      toast.error("Failed to load pending refunds")
    } finally {
      setIsLoading(false)
    }
  }

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
        setWalletAddress(accounts[0])
        console.log("Connected account:", accounts[0])

        // Check if connected to admin account
        if (accounts[0].toLowerCase() !== "0x983c601C20dDD0C9729D3167700a06b933D7b0d3".toLowerCase()) {
          toast.warning("Please connect with the admin wallet")
        } else {
          toast.success("Admin wallet connected")
        }
      } catch (err) {
        console.error("User rejected the connection", err)
        toast.error("Failed to connect wallet")
      }
    } else {
      toast.error("Please install MetaMask to connect your wallet!")
    }
  }

  const processRefund = async (refund: any) => {
    if (!walletAddress) {
      toast.error("Please connect your wallet first")
      return
    }

    // Verify that the connected wallet is the admin wallet
    if (walletAddress.toLowerCase() !== "0x983c601C20dDD0C9729D3167700a06b933D7b0d3".toLowerCase()) {
      toast.error("Only the admin wallet can process refunds")
      return
    }

    try {
      toast.info("Processing refund...")

      // In a real implementation, you would use a private key to send the refund
      // This would typically be handled by a secure backend service
      // Here we're using the connected wallet instead for demonstration
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Create and send the refund transaction
      const tx = {
        to: refund.walletAddress,
        value: ethers.parseEther(refund.amount)
      }
      
      const transaction = await signer.sendTransaction(tx)
      const etherscanLink = `https://sepolia.etherscan.io/tx/${transaction.hash}`
      
      toast.info(
        <div>
          Processing refund... 
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
      )
      
      // Wait for transaction confirmation
      await transaction.wait()

      // Update the UI to remove the processed refund
      setPendingRefunds(pendingRefunds.filter(r => r.id !== refund.id))
      
      toast.success("Refund processed successfully!")
    } catch (error: any) {
      console.error("Error processing refund:", error)
      toast.error("Failed to process refund: " + error.message)
    }
  }

  if (!session) {
    return <div className="p-8">Redirecting to login...</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded-md">
        <h2 className="text-xl font-semibold mb-2">Wallet Connection</h2>
        {walletAddress ? (
          <div>
            <p className="mb-2">Connected: <span className="font-mono">{walletAddress}</span></p>
            <p className="text-sm text-gray-600 mb-2">
              {walletAddress.toLowerCase() === "0x983c601C20dDD0C9729D3167700a06b933D7b0d3".toLowerCase() 
                ? "✅ Admin wallet connected" 
                : "❌ Please connect with the admin wallet"}
            </p>
          </div>
        ) : (
          <Button onClick={connectWallet}>Connect Admin Wallet</Button>
        )}
      </div>
      
      <div className="p-4 bg-white shadow rounded-md">
        <h2 className="text-xl font-semibold mb-4">Pending Refunds</h2>
        
        {isLoading ? (
          <p>Loading pending refunds...</p>
        ) : pendingRefunds.length === 0 ? (
          <p>No pending refunds.</p>
        ) : (
          <div className="space-y-4">
            {pendingRefunds.map((refund) => (
              <div key={refund.id} className="p-4 border rounded-md">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-sm text-gray-600">User:</p>
                    <p>{refund.userName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Course:</p>
                    <p>{refund.courseTitle}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Wallet Address:</p>
                    <p className="font-mono text-sm truncate">{refund.walletAddress}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Amount:</p>
                    <p>{refund.amount} ETH</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Requested:</p>
                    <p>{new Date(refund.requestDate).toLocaleString()}</p>
                  </div>
                </div>
                <Button 
                  className="bg-green-600 hover:bg-green-700" 
                  onClick={() => processRefund(refund)}
                  disabled={!walletAddress || walletAddress.toLowerCase() !== "0x983c601C20dDD0C9729D3167700a06b933D7b0d3".toLowerCase()}
                >
                  Process Refund
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 