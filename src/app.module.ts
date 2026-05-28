// src/app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { appConfig, databaseConfig } from "./config";
import { AppointmentsModule } from "./appointments/appointments.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      envFilePath: ".env",
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get<string>("database.host"),
        port: configService.get<number>("database.port"),
        username: configService.get<string>("database.username"),
        password: configService.get<string>("database.password"),
        database: configService.get<string>("database.name"),
        entities: [__dirname + "/**/*.entity.{ts,js}"],
        synchronize: false,
        logging: configService.get<string>("app.nodeEnv") === "development",
        ssl: configService.get<boolean>("database.ssl") ?? false,
      }),
    }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 60 }]),
    AppointmentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
