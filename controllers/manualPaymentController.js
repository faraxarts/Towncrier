const crypto =
  require("crypto");

const Level =
  require("../models/Level");

const UserLevelAccess =
  require("../models/UserLevelAccess");

const ManualPaymentRequest =
  require("../models/ManualPaymentRequest");

const {
  uploadBuffer,
  deleteAsset,
} = require("../services/cloudinaryService");


/* =========================================================
   PAYMENT REFERENCE
   ========================================================= */

function generateReference(
  level,
  userId
) {
  const random =
    crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase();


  const levelPart =
    String(
      level.order || 1
    ).padStart(
      2,
      "0"
    );


  const userPart =
    String(
      userId
    )
      .slice(-6)
      .toUpperCase();


  return (
    `TCM-L${levelPart}-` +
    `${userPart}-` +
    `${random}`
  );
}


/* =========================================================
   MANUAL PAYMENT PAGE
   ========================================================= */

exports.getManualPaymentPage =
  async (
    req,
    res
  ) => {
    try {
      const academy =
        req.academy;


      const level =
        await Level.findOne({
          _id:
            req.params.levelId,

          academy:
            academy._id,

          isPublished:
            true,
        });


      if (!level) {
        return res
          .status(404)
          .send(
            "Level not found"
          );
      }


      const existingAccess =
        await UserLevelAccess.findOne({
          user:
            req.session.userId,

          level:
            level._id,

          status:
            "active",
        });


      if (
        existingAccess
      ) {
        return res.redirect(
          `/academy/${academy.slug}/courses?payment=already-unlocked`
        );
      }


      let paymentRequest =
        await ManualPaymentRequest.findOne({
          user:
            req.session.userId,

          level:
            level._id,

          status: {
            $in: [
              "initiated",
              "pending",
            ],
          },
        }).sort({
          createdAt: -1,
        });


      if (
        !paymentRequest
      ) {
        paymentRequest =
          await ManualPaymentRequest.create({
            user:
              req.session.userId,

            level:
              level._id,

            reference:
              generateReference(
                level,
                req.session.userId
              ),

            amountLabel:
              level.price ||
              "",

            status:
              "initiated",
          });
      }


      return res.render(
        "hub/manual-level-payment",
        {
          academy,
          level,
          paymentRequest,

          bankName:
            process.env
              .MANUAL_PAYMENT_BANK_NAME ||
            "",

          accountName:
            process.env
              .MANUAL_PAYMENT_ACCOUNT_NAME ||
            "",

          accountNumber:
            process.env
              .MANUAL_PAYMENT_ACCOUNT_NUMBER ||
            "",
        }
      );
    } catch (error) {
      console.error(
        "Get manual payment page error:",
        error
      );


      return res
        .status(500)
        .render(
          "500",
          {
            pageTitle:
              "Server Error",

            message:
              "Something unexpected happened while processing that request. Please try again shortly.",
          }
        );
    }
  };


/* =========================================================
   SUBMIT MANUAL PAYMENT
   ========================================================= */

exports.submitManualPaymentRequest =
  async (
    req,
    res
  ) => {

    let newProofUpload =
      null;


    try {
      const academy =
        req.academy;


      const level =
        await Level.findOne({
          _id:
            req.params.levelId,

          academy:
            academy._id,
        });


      if (!level) {
        return res
          .status(404)
          .send(
            "Level not found"
          );
      }


      const requestId =
        req.body.requestId?.trim();


      const payerName =
        req.body.payerName?.trim();


      const transactionNumber =
        req.body
          .transactionNumber
          ?.trim();


      const note =
        req.body.note?.trim() ||
        "";


      if (
        !requestId ||
        !payerName ||
        !transactionNumber
      ) {
        return res
          .status(400)
          .send(
            "Please fill in all required payment fields."
          );
      }


      const paymentRequest =
        await ManualPaymentRequest.findOne({
          _id:
            requestId,

          user:
            req.session.userId,

          level:
            level._id,
        });


      if (
        !paymentRequest
      ) {
        return res
          .status(404)
          .send(
            "Payment request not found."
          );
      }


      /* ===================================================
         PRESERVE OLD PROOF METADATA

         If a learner replaces a proof, we upload the
         new file first. Only after MongoDB saves
         successfully do we delete the old Cloudinary file.
         =================================================== */

      const oldProof = {
        url:
          paymentRequest
            .proofUrl ||
          "",

        publicId:
          paymentRequest
            .proofPublicId ||
          "",

        resourceType:
          paymentRequest
            .proofResourceType ||
          "",
      };


      /* ===================================================
         UPLOAD NEW PROOF IF PROVIDED
         =================================================== */

      if (req.file) {
        newProofUpload =
          await uploadBuffer(
            req.file.buffer,
            {
              folder:
                "tcem/payments/proofs",

              resourceType:
                "auto",

              originalFilename:
                req.file.originalname,
            }
          );
      }


      /* ===================================================
         UPDATE REQUEST
         =================================================== */

      paymentRequest.payerName =
        payerName;


      paymentRequest.transactionNumber =
        transactionNumber;


      paymentRequest.note =
        note;


      paymentRequest.status =
        "pending";


      if (
        newProofUpload
      ) {
        paymentRequest.proofUrl =
          newProofUpload.url;


        paymentRequest.proofPublicId =
          newProofUpload.publicId;


        paymentRequest.proofResourceType =
          newProofUpload.resourceType;


        paymentRequest.proofOriginalName =
          req.file.originalname;


        paymentRequest.proofMimeType =
          req.file.mimetype ||
          "";


        paymentRequest.proofBytes =
          newProofUpload.bytes ||
          req.file.size ||
          0;
      }


      /* ===================================================
         DATABASE FIRST
         =================================================== */

      await paymentRequest.save();


      /* ===================================================
         DELETE OLD CLOUDINARY PROOF

         Only after the new URL has safely reached MongoDB.
         =================================================== */

      if (
        newProofUpload &&
        oldProof.publicId
      ) {
        try {
          await deleteAsset(
            oldProof.publicId,

            oldProof.resourceType ||
              "image"
          );
        } catch (
          cleanupError
        ) {
          /*
           * The payment request is already safe.
           * A failed cleanup should not break submission.
           */
          console.error(
            "Old payment proof cleanup error:",
            cleanupError
          );
        }
      }


      return res.redirect(
        `/academy/${academy.slug}/courses?payment=pending`
      );
    } catch (error) {

      /*
       * If the new Cloudinary upload happened but
       * MongoDB save subsequently failed, remove
       * the new proof to avoid wasting Cloudinary storage.
       */
      if (
        newProofUpload
          ?.publicId
      ) {
        try {
          await deleteAsset(
            newProofUpload
              .publicId,

            newProofUpload
              .resourceType ||
              "image"
          );
        } catch (
          cleanupError
        ) {
          console.error(
            "Payment proof upload cleanup error:",
            cleanupError
          );
        }
      }


      console.error(
        "Submit manual payment request error:",
        error
      );


      return res
        .status(500)
        .render(
          "500",
          {
            pageTitle:
              "Server Error",

            message:
              "Something unexpected happened while processing that request. Please try again shortly.",
          }
        );
    }
  };