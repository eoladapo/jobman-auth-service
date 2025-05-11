import { StatusCodes } from 'http-status-codes';
import { changePasswordSchema, emailSchema, passwordSchema } from '@auth/schemes/password';
import {
  getAuthUserByPasswordToken,
  getUserByEmail,
  getUserByUsername,
  updatePassword,
  updatePasswordToken
} from '@auth/services/auth.service';
import { BadRequestError, IAuthDocument, IEmailMessageDetails } from '@eoladapo/jobman-shared';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '@auth/config';
import { publishDirectMessage } from '@auth/queues/auth.producers';
import { authChannel } from '@auth/server';
import { AuthModel } from '@auth/models/auth.schema';

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { error } = await Promise.resolve(emailSchema.validate(req.body));
  if (error?.details) {
    throw new BadRequestError(error.details[0].message, 'ForgotPassword create() method error');
  }

  const { email } = req.body;
  const existingUser = await getUserByEmail(email);
  if (!existingUser) {
    throw new BadRequestError('Invalid credentials', 'ForgotPassword create() method error');
  }

  // create a random token
  const randomBytes = await Promise.resolve(crypto.randomBytes(20));
  const randomCharacters: string = randomBytes.toString('hex');

  // create the date expiration
  const date: Date = new Date();
  date.setHours(date.getHours() + 1);
  await updatePasswordToken(existingUser.id!, randomCharacters, date);

  // create reset-link
  const resetLink = `${config.CLIENT_URL}/reset-password?token=${randomCharacters}`;

  // create the message to send to the queue
  const messageDetails: IEmailMessageDetails = {
    receiverEmail: existingUser.email!,
    verifyLink: resetLink,
    template: 'forgotPassword'
  };
  await publishDirectMessage(
    authChannel,
    'jobman-email-notification',
    'auth-email',
    JSON.stringify(messageDetails),
    'Forgot password message sent to notification service.'
  );

  res.status(StatusCodes.OK).json({ message: 'Password reset link sent to your email' });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { error } = await Promise.resolve(passwordSchema.validate(req.body));
  if (error?.details) {
    throw new BadRequestError(error.details[0].message, 'ResetPassword update() method error');
  }

  const { password, confirmPassword } = req.body;
  const { token } = req.params;
  if (password !== confirmPassword) {
    throw new BadRequestError('Passwords do not match', 'ResetPassword update() method error');
  }

  const existingUser: IAuthDocument = await getAuthUserByPasswordToken(token);
  if (!existingUser) {
    throw new BadRequestError('Invalid credentials', 'ResetPassword update() method error');
  }

  const hashedPassword: string = await AuthModel.prototype.hashPassword(password);

  await updatePassword(existingUser.id!, hashedPassword);
  const messageDetails: IEmailMessageDetails = {
    username: existingUser.username!,
    template: 'resetPasswordSuccess'
  };
  await publishDirectMessage(
    authChannel,
    'jobman-email-notification',
    'auth-email',
    JSON.stringify(messageDetails),
    'Reset password success message sent to notification service.'
  );

  res.status(StatusCodes.OK).json({ message: 'Password reset successfully' });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { error } = await Promise.resolve(changePasswordSchema.validate(req.body));
  if (error?.details) {
    throw new BadRequestError(error.details[0].message, 'Password changePassword() method error');
  }

  const { currentPassword, newPassword } = req.body();
  if (currentPassword !== newPassword) {
    throw new BadRequestError('Invalid password', 'Password changePassword() method error');
  }

  const existingUser: IAuthDocument = await getUserByUsername(`${req.currentUser?.username}`);
  if (!existingUser) {
    throw new BadRequestError('Invalid password', 'ResetPassword update() method error');
  }

  const hashedPassword: string = await AuthModel.prototype.hashPassword(newPassword);

  await updatePassword(existingUser.id!, hashedPassword);
  const messageDetails: IEmailMessageDetails = {
    username: existingUser.username!,
    template: 'resetPasswordSuccess'
  };
  await publishDirectMessage(
    authChannel,
    'jobman-email-notification',
    'auth-email',
    JSON.stringify(messageDetails),
    'password change success message sent to notification service.'
  );

  res.status(StatusCodes.OK).json({ message: 'Password reset successfully' });
}
