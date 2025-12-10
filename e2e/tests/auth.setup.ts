import { test as setup } from '@playwright/test';
import { loginWithEmail, signupWithEmail } from '../logic/api/apiCalls';
import { getTestUser } from '../config/urls';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const { email, password } = getTestUser();

  try {
    // Try to login first
    let response = await loginWithEmail(
      email,
      password,
      page.request
    );

    // If login fails, try to create the user
    if (!response.success) { 
      const signupResponse = await signupWithEmail(
        'Test',
        'User',
        email,
        password,
        page.request
      );

      if (!signupResponse.success) {
        throw new Error(`Failed to create test user: ${signupResponse.error || 'Unknown error'}`);
      }
    } 
  } catch (error) {
    const errorMessage = (error as Error).message;
    throw new Error(
      `Authentication failed. \n Error: ${errorMessage}`
    );
  }

  // Save authentication state (cookies and storage)
  await page.context().storageState({ path: authFile });
});
