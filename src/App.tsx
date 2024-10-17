import React, { useState, useEffect } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import { motion } from 'framer-motion';
import { keyframes } from '@emotion/react';
import {
  ChakraProvider,
  extendTheme,
  Box,
  VStack,
  Heading,
  FormControl,
  FormLabel,
  Textarea,
  Input,
  Select,
  Button,
  Flex,
  Text,
  useToast,
} from '@chakra-ui/react';
import { Mic } from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import Auth from './components/Auth';
import Navbar from './components/Navbar';

const pulseKeyframes = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(26, 255, 125, 0.4); }
  70% { box-shadow: 0 0 0 20px rgba(26, 255, 125, 0); }
  100% { box-shadow: 0 0 0 0 rgba(26, 255, 125, 0); }
`;

const theme = extendTheme({
  fonts: {
    body: '"Spectral", serif',
    heading: '"Spectral", serif',
  },
  colors: {
    neonGreen: {
      50: '#E6FFED',
      100: '#B3FFD1',
      200: '#80FFB5',
      300: '#4DFF99',
      400: '#1AFF7D',
      500: '#00E664',
      600: '#00B34F',
      700: '#00803A',
      800: '#004D24',
      900: '#001A0F',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.50',
        color: 'gray.800',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
        borderRadius: 'md',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      },
      variants: {
        solid: {
          bg: 'neonGreen.500',
          color: 'white',
          _hover: {
            bg: 'neonGreen.600',
          },
        },
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            borderColor: 'gray.300',
            _focus: {
              borderColor: 'neonGreen.500',
              boxShadow: '0 0 0 1px #00E664',
            },
            _hover: {
              borderColor: 'neonGreen.400',
            },
          },
        },
      },
    },
    Textarea: {
      variants: {
        outline: {
          borderColor: 'gray.300',
          _focus: {
            borderColor: 'neonGreen.500',
            boxShadow: '0 0 0 1px #00E664',
          },
          _hover: {
            borderColor: 'neonGreen.400',
          },
        },
      },
    },
    Select: {
      variants: {
        outline: {
          field: {
            borderColor: 'gray.300',
            _focus: {
              borderColor: 'neonGreen.500',
              boxShadow: '0 0 0 1px #00E664',
            },
            _hover: {
              borderColor: 'neonGreen.400',
            },
          },
        },
      },
    },
  },
});

const webClient = new RetellWebClient();
const YOUR_API_KEY = 'key_1d2025c27c6328b3f9840255e4df';

interface LLMData {
  llm_id: string;
  llm_websocket_url: string;
}

interface AgentData {
  agent_id: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [generalPrompt, setGeneralPrompt] = useState<string>(
    'You are a helpful assistant for our restaurant...'
  );
  const [beginMessage, setBeginMessage] = useState<string>(
    'Hi, I am Nala, how can I assist you today?'
  );
  const [model, setModel] = useState<string>('gpt-4o');
  const [llmData, setLLMData] = useState<LLMData | null>(null);
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [callStatus, setCallStatus] = useState<
    'not-started' | 'active' | 'inactive'
  >('not-started');
  const toast = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadUserData(currentUser.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    webClient.on('conversationStarted', () => {
      console.log('Conversation started');
      setCallStatus('active');
    });

    webClient.on('conversationEnded', ({ code, reason }) => {
      console.log('Conversation ended with code:', code, ', reason:', reason);
      setCallStatus('inactive');
    });

    webClient.on('error', (error) => {
      console.error('An error occurred:', error);
      setCallStatus('inactive');
    });

    webClient.on('update', (update) => {
      if (update.type === 'transcript' && update.transcript) {
        console.log(`${update.transcript.speaker}: ${update.transcript.text}`);
      }
    });
  }, []);

  const loadUserData = async (userId: string) => {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      setGeneralPrompt(data.generalPrompt || '');
      setBeginMessage(data.beginMessage || '');
      setModel(data.model || 'gpt-4o');
      setLLMData(data.llmData || null);
      setAgentData(data.agentData || null);
    }
  };

  const saveLLM = async () => {
    if (!user) return;

    try {
      const response = await fetch(
        'https://api.retellai.com/create-retell-llm',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${YOUR_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            general_prompt: generalPrompt,
            begin_message: beginMessage,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setLLMData(data);
      console.log('LLM created successfully:', data);

      // Create agent after LLM is created
      await createAgent(data.llm_websocket_url);

      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        generalPrompt,
        beginMessage,
        model,
        llmData: data,
        agentData,
      });

      toast({
        title: 'Changes saved successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error creating LLM:', error);
      toast({
        title: 'Error saving changes.',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const createAgent = async (llmWebsocketUrl: string) => {
    try {
      const response = await fetch('https://api.retellai.com/create-agent', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${YOUR_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          llm_websocket_url: llmWebsocketUrl,
          agent_name: 'Restaurant Assistant',
          voice_id: '11labs-Adrian',
          language: 'en-US',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAgentData(data);
      console.log('Agent created successfully:', data);
    } catch (error) {
      console.error('Error creating agent:', error);
    }
  };

  const toggleConversation = async () => {
    if (callStatus === 'active') {
      webClient.stopCall();
      setCallStatus('inactive');
    } else {
      if (!agentData) {
        console.error('Agent not created yet');
        return;
      }

      try {
        const response = await fetch(
          'https://api.retellai.com/v2/create-web-call',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${YOUR_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agent_id: agentData.agent_id,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        webClient
          .startCall({
            accessToken: data.access_token,
            callId: data.call_id,
            sampleRate: 16000,
            enableUpdate: true,
          })
          .catch(console.error);
        setCallStatus('active');
      } catch (error) {
        console.error('Error starting call:', error);
      }
    }
  };

  return (
    <ChakraProvider theme={theme}>
      <Box
        minHeight="100vh"
        bg="gray.50"
        backgroundImage="radial-gradient(circle at 10% 20%, rgba(26, 255, 125, 0.1) 0%, transparent 40%)"
      >
        {user ? (
          <>
            <Navbar />
            <Box py={8}>
              <Flex maxWidth="1200px" margin="0 auto" gap={8}>
                {/* Left Side: Prompt Editor */}
                <Box
                  width="60%"
                  bg="white"
                  p={8}
                  borderRadius="xl"
                  boxShadow="0 4px 6px rgba(26, 255, 125, 0.1)"
                  position="relative"
                  overflow="hidden"
                >
                  <Box
                    position="absolute"
                    top="0"
                    left="0"
                    right="0"
                    height="4px"
                    bgGradient="linear(to-r, neonGreen.400, neonGreen.200)"
                  />
                  <Heading
                    as="h1"
                    size="xl"
                    mb={8}
                    color="gray.800"
                    textAlign="center"
                  >
                    Virtual Assistant
                  </Heading>
                  <VStack spacing={6} align="stretch">
                    <Box bg="gray.50" p={4} borderRadius="md" boxShadow="sm">
                      <FormControl>
                        <FormLabel color="gray.700" fontWeight="medium">
                          General Prompt
                        </FormLabel>
                        <Textarea
                          value={generalPrompt}
                          onChange={(e) => setGeneralPrompt(e.target.value)}
                          rows={4}
                          bg="white"
                          color="gray.800"
                        />
                      </FormControl>
                    </Box>
                    <Box bg="gray.50" p={4} borderRadius="md" boxShadow="sm">
                      <FormControl>
                        <FormLabel color="gray.700" fontWeight="medium">
                          Begin Message
                        </FormLabel>
                        <Input
                          type="text"
                          value={beginMessage}
                          onChange={(e) => setBeginMessage(e.target.value)}
                          bg="white"
                          color="gray.800"
                        />
                      </FormControl>
                    </Box>
                    <Box bg="gray.50" p={4} borderRadius="md" boxShadow="sm">
                      <FormControl>
                        <FormLabel color="gray.700" fontWeight="medium">
                          Model Selection
                        </FormLabel>
                        <Select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          bg="white"
                          color="gray.800"
                        >
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        </Select>
                      </FormControl>
                    </Box>
                    <Button onClick={saveLLM} size="lg" width="100%">
                      Save Changes
                    </Button>
                  </VStack>
                </Box>

                {/* Right Side: Mic Only */}
                <Flex
                  width="40%"
                  alignItems="center"
                  justifyContent="center"
                  position="relative"
                >
                  <Box
                    position="absolute"
                    top="0"
                    left="0"
                    right="0"
                    bottom="0"
                    bgGradient="radial(circle at center, rgba(26, 255, 125, 0.2) 0%, transparent 70%)"
                    filter="blur(40px)"
                    zIndex="0"
                  />
                  <Box
                    position="relative"
                    onClick={toggleConversation}
                    cursor="pointer"
                    zIndex="1"
                  >
                    <Box
                      as={motion.div}
                      bg={callStatus === 'active' ? 'neonGreen.500' : 'white'}
                      rounded="full"
                      p={16}
                      animate={{
                        scale: callStatus === 'active' ? [1, 1.1, 1] : 1,
                      }}
                      transition={{
                        duration: 0.5,
                        repeat: callStatus === 'active' ? Infinity : 0,
                        repeatType: 'reverse',
                      }}
                      _hover={{ transform: 'scale(1.05)' }}
                      boxShadow={`0 0 20px ${
                        callStatus === 'active'
                          ? 'rgba(26, 255, 125, 0.6)'
                          : 'rgba(26, 255, 125, 0.2)'
                      }`}
                      animation={`${pulseKeyframes} 2s infinite`}
                    >
                      <Mic
                        size={128}
                        color={callStatus === 'active' ? 'white' : '#95ff81'}
                        className={`w-32 h-32 ${
                          callStatus === 'active' ? 'animate-bounce' : '#95ff81'
                        }`}
                      />
                    </Box>
                    {callStatus === 'active' && (
                      <Box
                        position="absolute"
                        top="-12px"
                        left="-12px"
                        right="-12px"
                        bottom="-12px"
                        rounded="full"
                        border="4px solid"
                        borderColor="neonGreen.400"
                        opacity={0.5}
                        animation="ping 1s cubic-bezier(0, 0, 0.2, 1) infinite"
                      />
                    )}
                  </Box>
                  <Text
                    position="absolute"
                    bottom="20%"
                    left="50%"
                    transform="translateX(-50%)"
                    fontSize="xl"
                    fontWeight="semibold"
                    color="neonGreen.600"
                    textAlign="center"
                  >
                    {callStatus === 'active' ? 'Listening...' : 'Click to Start'}
                  </Text>
                </Flex>
              </Flex>
            </Box>
          </>
        ) : (
          <Auth />
        )}
      </Box>
    </ChakraProvider>
  );
}

export default App;