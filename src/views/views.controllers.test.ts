import { StatusCodes } from "http-status-codes";
import { beforeEach, describe, expect, Mock, test, vi } from "vitest";

import { getRankings } from "../api/rankings/rankings.services";
import { emailConfig } from "../config/constants";
import { getHostName, hashKey } from "../utils/helpers";
import mail from "../utils/mail";
import {
  getAboutPage,
  getContactPage, // getHealthCheckPage,
  getHomePage,
  getPrivacyPage,
  getRegisterPage,
  getResetAPIKeyPage,
  getStatusPage,
  getTermsPage,
  getVerifyEmailPage,
  postContactPage,
  postRegisterPage,
} from "./views.controllers";
import { User } from "./views.models";
import { sendWelcomeEmail } from "./views.services";

vi.mock("../utils/mail", async () => ({
  ...((await import("../utils/mail")) as object),
  mail: {
    sendMail: vi.fn(),
  },
}));

vi.mock("./views.services", async () => ({
  ...((await import("./views.services")) as object),
  sendWelcomeEmail: vi.fn(),
}));

vi.mock("../utils/helpers", async () => ({
  ...((await import("../utils/helpers")) as object),
  // hashKey: vi.fn(),
  getHostName: vi.fn(),
}));

// vi.mock('./views.services', async () => ({
//   ...((await import('./views.services')) as object),
//   sendWelcomeEmail: vi.fn(),
// }));

vi.mock("../api/rankings/rankings.services", async () => ({
  ...((await import("../api/rankings/rankings.services")) as object),
  getRankings: vi.fn(),
}));

vi.mock("./views.models", async () => ({
  // ...((await import('./views.models')) as object),
  User: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getHomePage", () => {
  test("returns home page", async () => {
    const req = {} as any;
    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    (getRankings as Mock).mockResolvedValueOnce([]);

    await getHomePage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith("home.html", {
      path: "/home",
      rankings: [],
    });
  });
});

describe("getRegisterPage", () => {
  test("returns register page", async () => {
    const req = {
      flash: vi.fn(() => []),
    } as any;

    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    getRegisterPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith("register.html", {
      path: "/register",
      messages: req.flash(),
    });
  });
});

describe("postRegisterPage", () => {
  test("should be able to register a user", async () => {
    const req = {
      body: {
        email: "jaw@jaw.com",
        name: "jaw",
      },
      get: vi.fn(() => ""),
      flash: vi.fn(() => []),
    } as any;

    const res = {
      status: vi.fn(),
      render: vi.fn(),
      redirect: vi.fn(),
    } as any;

    (User.findOne as Mock).mockResolvedValueOnce({
      id: 1,
    });

    (User.create as Mock).mockResolvedValueOnce({
      id: 1,
    });

    // hashKey.mockResolvedValueOnce({ key: '' });

    // sendVerificationEmail.mockResolvedValueOnce();

    // getHostName.mockReturnValueOnce('localhost');

    await postRegisterPage(req, res);

    expect(res.redirect).toHaveBeenCalledWith("/register");
  });
});

describe("getTermsPage", () => {
  test("returns terms page", async () => {
    const req = {} as any;
    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    getTermsPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith("terms.html", {
      path: "/terms",
    });
  });
});

describe("getPrivacyPage", () => {
  test("returns privacy page", async () => {
    const req = {} as any;
    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    getPrivacyPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith("privacy.html", {
      path: "/privacy",
    });
  });
});

describe("getAboutPage", () => {
  test("returns about page", async () => {
    const req = {} as any;
    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    getAboutPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith("about.html", {
      path: "/about",
    });
  });
});

describe("getStatusPage", () => {
  test("returns status page", async () => {
    const req = {} as any;
    const res = {
      status: vi.fn(() => res),
      render: vi.fn(),
    } as any;

    getStatusPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith("status.html", {
      path: "/status",
    });
  });
});

describe("getContactPage", () => {
  test("returns contact page", async () => {
    const req = {
      flash: vi.fn(() => []),
    } as any;
    const res = {
      path: vi.fn(() => res),
      render: vi.fn(),
      status: vi.fn(() => res),
    } as any;

    getContactPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith("contact.html", {
      path: "/contact",
      messages: req.flash(),
    });
  });
});

describe("getVerifyEmailPage", () => {
  test("should return error when user does not exist", async () => {
    const req = {
      flash: vi.fn(() => []),
      query: {
        token: "token",
        email: "email",
      },
    } as any;

    const res = {
      render: vi.fn(),
      status: vi.fn(() => res),
      redirect: vi.fn(),
    } as any;

    (User.findOne as Mock).mockResolvedValueOnce({ id: 1 });

    await getVerifyEmailPage(req, res);

    expect(res.redirect).toHaveBeenCalledWith("/register");
    expect(req.flash).toHaveBeenCalledWith(
      "error",
      "Something wrong while verifying your account!",
    );
  });

  test("should return error if email has already been used for verification", async () => {
    const req = {
      flash: vi.fn(),
      query: {
        token: "token",
        email: "email",
      },
    } as any;

    const res = {
      redirect: vi.fn(),
    } as any;

    const findOneMock = vi.spyOn(User, "findOne");
    findOneMock.mockResolvedValueOnce({
      verified: true,
      id: 1,
      email: "email",
      name: "name",
      verification_token: "token",
    });

    await getVerifyEmailPage(req, res);
    expect(findOneMock).toHaveBeenCalledWith({
      email: {
        $eq: "email",
      },
    });
    expect(res.redirect).toHaveBeenCalledWith("/register");
    expect(req.flash).toHaveBeenCalledWith(
      "error",
      "This e-mail has already been used for verification!",
    );
  });

  test("should return error if token is invalid", async () => {
    const req = {
      flash: vi.fn(),
      query: {
        token: "xxxxxx",
        email: "email",
      },
    } as any;

    const res = {
      redirect: vi.fn(),
    } as any;

    const findOneMock = vi.spyOn(User, "findOne");
    findOneMock.mockResolvedValueOnce({
      verified: true,
      id: 1,
      email: "email",
      name: "name",
      verification_token: "token",
    });

    await getVerifyEmailPage(req, res);
    expect(findOneMock).toHaveBeenCalledWith({
      email: {
        $eq: "email",
      },
    });
    expect(res.redirect).toHaveBeenCalledWith("/register");
    expect(req.flash).toHaveBeenCalledWith(
      "error",
      "Something wrong while verifying your account!",
    );
  });

  test("should be able to successfully verify email", async () => {
    const res = {
      redirect: vi.fn(),
    } as any;

    const req = {
      flash: vi.fn(),
      query: {
        token: "token",
        email: "email",
      },
    } as any;

    const findOneMock = vi.spyOn(User, "findOne");

    findOneMock.mockResolvedValueOnce({
      userId: 1,
      verified: false,
      email: "email",
      name: "name",
      verification_token: "token",
    });

    (sendWelcomeEmail as Mock).mockResolvedValueOnce({
      // userId: 1,
      email: "email",
      name: "name",
    });

    await getVerifyEmailPage(req, res);
    expect(findOneMock).toHaveBeenCalledWith({
      email: {
        $eq: "email",
      },
    });
    expect(res.redirect).toHaveBeenCalledWith("/register");
    expect(sendWelcomeEmail).toHaveBeenCalledWith({
      // userId: 1,
      email: "email",
      name: "name",
    });

    expect(req.flash).toHaveBeenCalledWith(
      "success",
      "Thank you for verifying your email address. We will send you an API key to your email very shortly!",
    );
  });
});

describe("getResetAPIKeyPage", () => {
  test("returns reset api key page", async () => {
    const req = {
      flash: vi.fn(() => []),
    } as any;

    const res = {
      render: vi.fn(),
      status: vi.fn(() => res),
    } as any;

    getResetAPIKeyPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith("reset-api-key.html", {
      path: "/reset-api-key",
      messages: req.flash(),
    });
  });
});

// describe('getHealthCheckPage', () => {
//   test('returns health check', async () => {
//     const req = {
//       flash: vi.fn(() => []),
//       originalUrl: 'url',
//       query: {
//         cache: 'true',
//       },
//     } as any;
//     const res = {
//       status: vi.fn(() => res),
//       json: vi.fn(),
//     } as any;

//     await getHealthCheckPage(req, res);

//     expect(res.status).toHaveBeenCalledWith(200);

//     expect(res.json).toHaveBeenCalledWith(
//       expect.objectContaining({
//         status: 'success',
//         request_url: 'url',
//         cache: 'true',
//         message: 'ok',
//         data: expect.arrayContaining([
//           expect.objectContaining({
//             method: expect.stringMatching(/^GET$/),
//             status: expect.any(Boolean),
//             url: expect.stringMatching(/^\/api\/rankings\/?/),
//           }),
//         ]),
//       }),
//     );
//   });
// });

describe("postContactPage", () => {
  test("should be able to send a contact", async () => {
    const req = {
      body: {
        name: "",
        email: "",
        message: "",
      },
      flash: vi.fn(),
    } as any;

    const res = {
      redirect: vi.fn(),
      status: vi.fn(() => res),
    } as any;

    mail.sendMail = vi.fn().mockResolvedValue({});

    await postContactPage(req, res);

    expect(mail.sendMail).toHaveBeenCalledWith({
      from: expect.any(String),
      to: expect.any(String),
      subject: expect.any(String),
      html: expect.any(String),
    });

    expect(req.flash).toHaveBeenCalledWith(
      "info",
      "Thanks for reaching out to us. We'll get back to you shortly!",
    );
    expect(res.status).toHaveBeenCalledWith(StatusCodes.TEMPORARY_REDIRECT);
    expect(res.redirect).toHaveBeenCalledWith("/contact");
  });
});
