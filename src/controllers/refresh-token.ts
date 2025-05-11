import { StatusCodes } from 'http-status-codes';
import { getUserByUsername, signToken } from '@auth/services/auth.service';
import { IAuthDocument } from '@eoladapo/jobman-shared';
import { Request, Response } from 'express';

export async function token(req: Request, res: Response): Promise<void> {
  const existingUser: IAuthDocument = await getUserByUsername(req.params.username);
  const userJWT: string = signToken(existingUser.id!, existingUser.email!, existingUser.username!);
  res.status(StatusCodes.OK).json({ message: 'Token refreshed', token: userJWT });
}
