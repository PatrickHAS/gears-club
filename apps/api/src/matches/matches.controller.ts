import {
  Controller,
  Body,
  Post,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  Patch,
  UseGuards,
  ParseEnumPipe,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
  Res,
  StreamableFile,
  ValidationPipe,
} from '@nestjs/common';

import { MatchesService } from './matches.service.js';
import { MatchTeam, UserRole } from '@prisma/client';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto.js';

import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('admin/disputes')
  @UseGuards(AdminGuard)
  async listPendingDisputes() {
    return this.matchesService.listPendingDisputes();
  }

  @Get(':id')
  async getMatchById(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.matchesService.getMatchById(matchId, request.user.id);
  }

  @Patch(':id/start')
  async startMatch(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.matchesService.startMatch(matchId, request.user.id);
  }

  @Post(':id/result-reports')
  async reportResult(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body('winnerTeam', new ParseEnumPipe(MatchTeam))
    winnerTeam: MatchTeam,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.matchesService.reportResult(
      matchId,
      request.user.id,
      winnerTeam,
    );
  }

  @Patch(':id/validate')
  @UseGuards(AdminGuard)
  async validateMatchResult(@Param('id', new ParseUUIDPipe()) matchId: string) {
    return this.matchesService.validateMatchResult(matchId);
  }

  @Get(':id/dispute-review')
  @UseGuards(AdminGuard)
  async getDisputeReview(@Param('id', new ParseUUIDPipe()) matchId: string) {
    return this.matchesService.getDisputeReview(matchId);
  }

  @Patch(':id/resolve-dispute')
  @UseGuards(AdminGuard)
  async resolveDispute(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Req() request: AuthenticatedRequest,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    body: ResolveDisputeDto,
  ) {
    return this.matchesService.resolveDispute({
      matchId,
      adminId: request.user.id,
      winnerTeam: body.winnerTeam,
      reason: body.reason,
      evidenceIds: body.evidenceIds,
      gamertagsVerified: body.gamertagsVerified,
    });
  }

  @Post(':id/dispute-evidences')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  async uploadDisputeEvidence(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie uma imagem no campo file.');
    }

    return this.matchesService.uploadDisputeEvidence(
      matchId,
      request.user.id,
      file.buffer,
    );
  }

  @Get(':id/dispute-evidences/:evidenceId/image')
  async getDisputeEvidenceImage(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Param('evidenceId', new ParseUUIDPipe()) evidenceId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const isAdmin = request.user.role === UserRole.ADMIN;

    const image = await this.matchesService.getDisputeEvidenceImage(
      matchId,
      evidenceId,
      request.user.id,
      isAdmin,
    );

    response.setHeader('Content-Type', 'image/png');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      'inline; filename="evidencia.png"',
    );

    return new StreamableFile(image);
  }
}
