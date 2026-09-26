import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UsersService } from './users.service';

/** Customer accounts for the people who take orders (linking a phone order to an account). */
@Controller('admin/customers')
@Roles(Role.ADMIN, Role.MANAGER)
export class CustomersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: CustomerQueryDto) {
    return this.users.listCustomers(query);
  }
}
