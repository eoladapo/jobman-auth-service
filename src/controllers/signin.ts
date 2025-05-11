import { StatusCodes } from 'http-status-codes';
import { AuthModel } from '@auth/models/auth.schema';
import { loginSchema } from '@auth/schemes/signin';
import { getUserByEmail, getUserByUsername, signToken } from '@auth/services/auth.service';
import { BadRequestError, IAuthDocument, isEmail } from '@eoladapo/jobman-shared';
import { Request, Response } from 'express';
import { omit } from 'lodash';

export async function read(req: Request, res: Response): Promise<void> {
  const { error } = await Promise.resolve(loginSchema.validate(req.body));

  if (error?.details) {
    throw new BadRequestError(error.details[0].message, 'SignIn read() method error');
  }

  const { username, password } = req.body;
  const isValidEmail: boolean = isEmail(username);

  // if (!isValidEmail) {
  //   existingUser = await getUserByUsername(username);
  // } else {
  //   existingUser = await getUserByEmail(username);
  // }

  // find the User
  const existingUser: IAuthDocument = isValidEmail ? await getUserByEmail(username) : await getUserByUsername(username);
  if (!existingUser) {
    throw new BadRequestError('Invalid credentials', 'SignIn read() method error');
  }

  // check if password match
  const isPasswordMatch: boolean = await AuthModel.prototype.comparePassword(password, existingUser.password!);
  if (!isPasswordMatch) {
    throw new BadRequestError('Invalid credentials', 'SignIn read() method error');
  }

  const userJWT: string = signToken(existingUser.id!, existingUser.email!, existingUser.username!);
  const userData: IAuthDocument = omit(existingUser, ['password']);
  res.status(StatusCodes.OK).json({ message: 'User login successfully', user: userData, token: userJWT });
}
