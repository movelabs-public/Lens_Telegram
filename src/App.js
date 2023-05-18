import { QueryClient, QueryClientProvider } from 'react-query';
import { EthereumClient, w3mConnectors, w3mProvider } from '@web3modal/ethereum'
import { Web3Modal } from '@web3modal/react'
import { configureChains, createClient, WagmiConfig } from 'wagmi'
import { arbitrum, mainnet, polygon } from 'wagmi/chains'
import { 
  useState, 
  useEffect } from 'react';
import { Web3Button } from '@web3modal/react'
import { useAccount, useSignMessage, useSignTypedData} from 'wagmi' 

const queryClient = new QueryClient();
const tele = window.Telegram.WebApp;
const chains = [arbitrum, mainnet, polygon]
const projectId = '5b815af3d7b504a9c5805693678c8c2d'

const { provider } = configureChains(chains, [w3mProvider({ projectId })])
const wagmiClient = createClient({autoConnect: true, connectors: w3mConnectors({ projectId, version: 1, chains }), provider})
const ethereumClient = new EthereumClient(wagmiClient, chains)


function App() {

  const { address, isConnected } = useAccount();
  useEffect(() => {tele.ready();}, []);


  return (
    <>
    <QueryClientProvider client={queryClient}>
      <WagmiConfig client={wagmiClient}>
        <div style={{ textAlign: 'center' }}>
        {isConnected ? <SuccessfulConnect address={address} isConnected={isConnected} /> : <RequestConnect />}
        <br />
        {isConnected ? <SignMessageButton /> : null}
        <br />
        {isConnected ? <SignTypedDataButton /> : null}
        <br />
        {isConnected ? <h1 style={{ overflowWrap: 'break-word', maxWidth: '100%', textAlign: 'center', fontSize: '0.85em' }}>Manage your Wallet 👇</h1> : null}
        <Web3Button />
        </div>

      </WagmiConfig>
      <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
      </QueryClientProvider>
    </>
);

}

function SignMessageButton() {

  const { data, isError, isLoading, isSuccess, signMessage } = useSignMessage({
    message: 'This Message is a trial for Signing, will be in use soon!',
  })

  return (
    <div>
      <button style={{ backgroundColor: '#3496FF', color: 'white', fontSize: '1em', padding: '10px 20px', fontWeight: 'bold',  borderRadius: '10px', border: 'none' }} disabled={isLoading} onClick={() => signMessage()}>
        Sign Message ✍️
      </button>
      {isSuccess && <div>Signature: {data}</div>}
      {isError && <div>Error signing message</div>}
    </div>
  )
}

function SignTypedDataButton() {
  const { data, error, isError, isLoading, isSuccess, signTypedData } =
    useSignTypedData({
      domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 137,
        verifyingContract: '0x0000000000000000000000000000000000000000',
      },
      types: {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      },
      primaryType: 'Mail',
      value: {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
      },
    })
 
  return (
    <div>
      <button style={{ backgroundColor: '#3496FF', color: 'white', fontSize: '1em', padding: '10px 20px', fontWeight: 'bold',  borderRadius: '10px', border: 'none' }} disabled={isLoading} onClick={() => signTypedData()}>
        Sign Typed Data ✍️
      </button>
      {isSuccess && <div>Signature: {data}</div>}
      {isError && <div>Error signing message: {error.message}</div>}
    </div>
  )
}

function RequestConnect() {
  return (
    <div style={{ textAlign: 'center', margin: '0 50px' }}>
      <h2>{'Welcome User! Please Connect Your Wallet 🙋‍♂️'}</h2>
    </div>
  );
}

function SuccessfulConnect({ address, isConnected }) {
  const [isSendingData, setIsSendingData] = useState(false);

  const handleClick = () => {
    setIsSendingData(true);
  };

  useEffect(() => {
    if (isSendingData && isConnected) {
      try {
        tele.sendData(JSON.stringify({ address }));
        console.log(`Sent address ${address} to bot.`);
      } catch (e) {
        console.error(`Error sending data: ${e}`);
      } finally {
        setIsSendingData(false);
      }
    }
  }, [isSendingData, address, isConnected]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px' }}>
      <br />
      <h1 style={{ overflowWrap: 'break-word', maxWidth: '100%', textAlign: 'center', fontSize: '1em', fontWeight: 'bold' }}>Wallet Connection<br />Established Successfully! ✅</h1>
      {isSendingData ? <p>Sending data...</p> : <button onClick={handleClick} style={{ backgroundColor: '#3496FF', color: 'white', fontSize: '1em', padding: '10px 20px', fontWeight: 'bold', borderRadius: '10px', border: 'none' }}>Connect Wallet to Bot 🤳</button>}
    </div>
  );
}

export default App;
