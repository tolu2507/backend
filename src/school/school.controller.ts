import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';

import { Roles } from '../common/auth.js';
import { ClassroomService } from './classroom.service.js';
import { FeesService } from './fees.service.js';
import { Actor, type SchoolActor } from './school.context.js';
import {
  AcademicYearDto,
  AssessmentDto,
  AttendanceDto,
  BulkInvoiceDto,
  ClassDto,
  ClassSubjectsDto,
  ImportStudentsDto,
  InviteStaffDto,
  NoteDto,
  ParentInputDto,
  RecordPaymentDto,
  ResultsDto,
  SchoolProfileDto,
  StudentDto,
  SubjectsDto,
  UpdateStudentDto,
} from './school.dto.js';
import { SchoolService } from './school.service.js';

/** The school dashboard API. Teachers see only their classes; owners and admins see everything. */
@Roles('SCHOOL_OWNER', 'SCHOOL_ADMIN', 'TEACHER')
@Controller('school')
export class SchoolController {
  constructor(
    private readonly school: SchoolService,
    private readonly classroom: ClassroomService,
    private readonly fees: FeesService,
  ) {}

  @Get() overview(@Actor() a: SchoolActor) {
    return this.school.overview(a);
  }
  @Patch() profile(@Actor() a: SchoolActor, @Body() dto: SchoolProfileDto) {
    return this.school.updateProfile(a, dto);
  }

  // Calendar
  @Get('years') years(@Actor() a: SchoolActor) {
    return this.school.years(a);
  }
  @Post('years') createYear(@Actor() a: SchoolActor, @Body() dto: AcademicYearDto) {
    return this.school.createYear(a, dto);
  }
  @HttpCode(200) @Post('years/:id/current') currentYear(@Actor() a: SchoolActor, @Param('id') id: string) {
    return this.school.setCurrentYear(a, id);
  }

  // Subjects & classes
  @Get('subjects') subjects(@Actor() a: SchoolActor) {
    return this.school.subjects(a);
  }
  @Post('subjects') addSubjects(@Actor() a: SchoolActor, @Body() dto: SubjectsDto) {
    return this.school.addSubjects(a, dto.names);
  }
  @Delete('subjects/:id') removeSubject(@Actor() a: SchoolActor, @Param('id') id: string) {
    return this.school.removeSubject(a, id);
  }
  @Get('classes') classes(@Actor() a: SchoolActor) {
    return this.school.classes(a);
  }
  @Post('classes') createClass(@Actor() a: SchoolActor, @Body() dto: ClassDto) {
    return this.school.saveClass(a, dto);
  }
  @Put('classes/:id') updateClass(@Actor() a: SchoolActor, @Param('id') id: string, @Body() dto: ClassDto) {
    return this.school.saveClass(a, dto, id);
  }
  @Delete('classes/:id') deleteClass(@Actor() a: SchoolActor, @Param('id') id: string) {
    return this.school.deleteClass(a, id);
  }
  @Put('classes/:id/subjects') classSubjects(@Actor() a: SchoolActor, @Param('id') id: string, @Body() dto: ClassSubjectsDto) {
    return this.school.setClassSubjects(a, id, dto);
  }

  // Attendance & scores
  @Get('classes/:id/attendance') attendance(@Actor() a: SchoolActor, @Param('id') id: string, @Query('date') date?: string) {
    return this.classroom.attendance(a, id, date ?? new Date().toISOString());
  }
  @Put('classes/:id/attendance') saveAttendance(@Actor() a: SchoolActor, @Param('id') id: string, @Body() dto: AttendanceDto) {
    return this.classroom.saveAttendance(a, id, dto);
  }
  @Get('classes/:id/assessments') assessments(@Actor() a: SchoolActor, @Param('id') id: string) {
    return this.classroom.assessments(a, id);
  }
  @Get('classes/:id/broadsheet') broadsheet(@Actor() a: SchoolActor, @Param('id') id: string) {
    return this.classroom.broadsheet(a, id);
  }
  @Post('assessments') createAssessment(@Actor() a: SchoolActor, @Body() dto: AssessmentDto) {
    return this.classroom.createAssessment(a, dto);
  }
  @Get('assessments/:id') scoreSheet(@Actor() a: SchoolActor, @Param('id') id: string) {
    return this.classroom.scoreSheet(a, id);
  }
  @Put('assessments/:id/results') saveScores(@Actor() a: SchoolActor, @Param('id') id: string, @Body() dto: ResultsDto) {
    return this.classroom.saveScores(a, id, dto);
  }
  @Delete('assessments/:id') deleteAssessment(@Actor() a: SchoolActor, @Param('id') id: string) {
    return this.classroom.deleteAssessment(a, id);
  }

  // Staff
  @Get('staff') staff(@Actor() a: SchoolActor) {
    return this.school.staff(a);
  }
  @Post('staff') invite(@Actor() a: SchoolActor, @Body() dto: InviteStaffDto) {
    return this.school.inviteStaff(a, dto);
  }
  @HttpCode(200) @Post('staff/:membershipId/resend') resend(@Actor() a: SchoolActor, @Param('membershipId') id: string) {
    return this.school.resendInvite(a, id);
  }
  @Delete('staff/:membershipId') removeStaff(@Actor() a: SchoolActor, @Param('membershipId') id: string) {
    return this.school.removeStaff(a, id);
  }

  // Students
  @Get('students') students(@Actor() a: SchoolActor, @Query('classId') classId?: string, @Query('q') search?: string) {
    return this.school.students(a, { classId, search });
  }
  @Post('students') addStudent(@Actor() a: SchoolActor, @Body() dto: StudentDto) {
    return this.school.addStudent(a, dto);
  }
  @Post('students/import') importStudents(@Actor() a: SchoolActor, @Body() dto: ImportStudentsDto) {
    return this.school.importStudents(a, dto.students);
  }
  @Get('students/:id') student(@Actor() a: SchoolActor, @Param('id') id: string) {
    return this.school.student(a, id);
  }
  @Patch('students/:id') updateStudent(@Actor() a: SchoolActor, @Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.school.updateStudent(a, id, dto);
  }
  @HttpCode(200) @Post('students/:id/reset-pin') resetPin(@Actor() a: SchoolActor, @Param('id') id: string) {
    return this.school.resetStudentPin(a, id);
  }
  @Post('students/:id/parents') addParent(@Actor() a: SchoolActor, @Param('id') id: string, @Body() dto: ParentInputDto) {
    return this.school.addParent(a, id, dto);
  }
  @Delete('students/:id/parents/:parentId') unlinkParent(@Actor() a: SchoolActor, @Param('id') id: string, @Param('parentId') parentId: string) {
    return this.school.unlinkParent(a, id, parentId);
  }
  @Post('students/:id/notes') addNote(@Actor() a: SchoolActor, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.classroom.addNote(a, id, dto);
  }
  @Delete('notes/:id') deleteNote(@Actor() a: SchoolActor, @Param('id') id: string) {
    return this.classroom.deleteNote(a, id);
  }
  @Get('reports') reports(@Actor() a: SchoolActor) {
    return this.school.reportStatus(a);
  }

  // Fees
  @Get('fees') feeList(@Actor() a: SchoolActor, @Query('termId') termId?: string, @Query('classId') classId?: string, @Query('status') status?: string) {
    return this.fees.list(a, { termId, classId, status });
  }
  @Post('fees') bill(@Actor() a: SchoolActor, @Body() dto: BulkInvoiceDto) {
    return this.fees.bulkCreate(a, dto);
  }
  @HttpCode(200) @Post('fees/:id/payments') recordPayment(@Actor() a: SchoolActor, @Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.fees.recordPayment(a, id, dto);
  }
  @HttpCode(200) @Post('fees/:id/void') voidInvoice(@Actor() a: SchoolActor, @Param('id') id: string) {
    return this.fees.void(a, id);
  }
}
