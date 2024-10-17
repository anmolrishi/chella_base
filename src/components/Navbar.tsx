import React from 'react';
import { Box, Flex, Button, Heading, useToast } from '@chakra-ui/react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const Navbar: React.FC = () => {
  const toast = useToast();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({
        title: 'Signed out successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'An error occurred while signing out.',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Box bg="neonGreen.500" px={4} py={2}>
      <Flex justifyContent="space-between" alignItems="center">
        <Heading size="md" color="white">Virtual Assistant Dashboard</Heading>
        <Button onClick={handleSignOut} colorScheme="whiteAlpha">Sign Out</Button>
      </Flex>
    </Box>
  );
};

export default Navbar;