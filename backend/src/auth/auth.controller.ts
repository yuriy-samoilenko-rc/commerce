import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { SkipAudit } from '../audit/skip-audit.decorator';
import { PublicUser } from '../users/users.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import { RegisterDto } from './dto/register.dto';

// AuthService writes precise entries itself (and must never log the password).
@SkipAudit()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Always 204, whether the email is known or not: the answer must not reveal accounts. */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  me(@CurrentUser() user: PublicUser) {
    return user;
  }

  @Patch('me')
  updateMe(@Body() dto: UpdateProfileDto, @CurrentUser() user: PublicUser) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.authService.changePassword(user.id, dto);
  }
}
