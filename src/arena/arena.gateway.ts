import { HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer, type OnGatewayConnection, type OnGatewayDisconnect, type OnGatewayInit } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import { Public, type AccessClaims } from '../common/auth.js';
import { ArenaService, type ArenaStudent, type Phrase } from './arena.service.js';
import { RoomsService } from './rooms.service.js';

/** `ready` settles once the token is checked, so a message sent straight after connecting isn't lost. */
type Client = Socket & { data: { me?: ArenaStudent; ready?: Promise<void> } };

const message = (e: unknown) => (e instanceof HttpException ? (e.getResponse() as { message?: string }).message ?? e.message : 'Something went wrong. Please try again.');

/**
 * Live rooms over Socket.IO at /arena. The app connects with its access token in `auth.token`.
 * Every client event replies with `room:error` on failure; state arrives as `room:state`.
 * The HTTP auth guard is skipped (@Public) because the socket checks the token itself when it connects.
 */
@Public()
@WebSocketGateway({ namespace: '/arena', cors: { origin: '*' } })
export class ArenaGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ArenaGateway.name);
  @WebSocketServer() io: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly arena: ArenaService,
    private readonly rooms: RoomsService,
  ) {}

  afterInit(io: Namespace) {
    this.rooms.attach(io);
  }

  handleConnection(client: Client) {
    client.data.ready = this.authenticate(client);
    return client.data.ready;
  }

  private async authenticate(client: Client) {
    try {
      const token = (client.handshake.auth as { token?: string }).token ?? '';
      const claims = await this.jwt.verifyAsync<AccessClaims>(token);
      if (!claims.roles.some((r) => r.role === 'STUDENT')) throw new Error('not a student');
      client.data.me = await this.arena.student(claims.sub);
    } catch (e) {
      client.emit('room:error', { message: e instanceof HttpException ? message(e) : 'Please sign in again.' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Client) {
    await client.data.ready;
    if (client.data.me) await this.rooms.disconnect(client.data.me, client.id);
  }

  private async safely(client: Client, fn: (me: ArenaStudent) => Promise<unknown>) {
    await client.data.ready;
    const me = client.data.me;
    if (!me) return;
    try {
      await fn(me);
    } catch (e) {
      if (!(e instanceof HttpException)) this.logger.error(e);
      client.emit('room:error', { message: message(e) });
    }
  }

  @SubscribeMessage('room:join')
  join(@ConnectedSocket() client: Client, @MessageBody() body: { code?: string }) {
    return this.safely(client, async (me) => {
      const joined = await this.rooms.join(me, client.id, String(body?.code ?? ''));
      await client.join(joined.room);
      client.emit('room:joined', { you: joined.you });
      // The broadcast in join() went out before this socket was in the room, so it gets its own copy.
      client.emit('room:state', joined.state);
      if (joined.question) client.emit('room:question', joined.question);
    });
  }

  @SubscribeMessage('room:leave')
  leave(@ConnectedSocket() client: Client, @MessageBody() body: { code?: string }) {
    return this.safely(client, (me) => this.rooms.leave(me, client.id, String(body?.code ?? '')));
  }

  @SubscribeMessage('room:start')
  start(@ConnectedSocket() client: Client, @MessageBody() body: { code?: string }) {
    return this.safely(client, (me) => this.rooms.start(me, String(body?.code ?? '')));
  }

  @SubscribeMessage('room:answer')
  answer(@ConnectedSocket() client: Client, @MessageBody() body: { code?: string; index?: number; optionId?: string | null }) {
    return this.safely(client, (me) => this.rooms.answer(me, String(body?.code ?? ''), Number(body?.index), typeof body?.optionId === 'string' ? body.optionId : null));
  }

  @SubscribeMessage('quick:search')
  search(@ConnectedSocket() client: Client, @MessageBody() body: { subjectId?: string }) {
    return this.safely(client, (me) => this.rooms.search(me, client.id, String(body?.subjectId ?? '')));
  }

  @SubscribeMessage('quick:cancel')
  cancel(@ConnectedSocket() client: Client) {
    return this.safely(client, async (me) => this.rooms.stopSearching(me.id));
  }

  @SubscribeMessage('room:chat')
  chat(@ConnectedSocket() client: Client, @MessageBody() body: { code?: string; phrase?: Phrase }) {
    return this.safely(client, async (me) => this.rooms.chat(me, String(body?.code ?? ''), body?.phrase as Phrase));
  }
}
