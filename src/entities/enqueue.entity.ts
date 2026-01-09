import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
/*
 * Examples
 */
export const EnqueueResponseExample = {
  id: 'Id Here',
  email: 'Notiofication Email Here',
  upstreamType: 'Upstream Type Here',
};

/*
 * Model definitions
 */
@Exclude()
@ApiSchema({ name: 'Enqueue' })
export class EnqueueEntity {
  @ApiProperty({
    example: EnqueueResponseExample['id'],
  })
  @Expose()
  id: string;

  @ApiProperty({
    example: EnqueueResponseExample['email'],
  })
  @Expose()
  email: string;

  @ApiProperty({
    example: EnqueueResponseExample['upstreamType'],
  })
  @Expose()
  upstreamType: string;

  constructor(object) {
    Object.assign(this, object);
  }
}
