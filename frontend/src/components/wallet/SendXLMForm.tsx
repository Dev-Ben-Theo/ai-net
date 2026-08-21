import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { TransactionBuilder, Operation, Asset, BASE_FEE, Networks, Memo, Horizon, Transaction } from '@stellar/stellar-sdk'
import { useWallet } from '../../context/WalletContext'
import { useWalletBalance } from '../../hooks/useWalletBalance'
import { signTransactionWithFreighter } from '../../services/freighter'
import { walletTransferSchema, type WalletTransferValues } from '../../schemas/wallet'
import { FormField } from '../common/FormField'
import styles from './SendXLMForm.module.css'

const HORIZON_URL = 'https://horizon-testnet.stellar.org'

export function SendXLMForm() {
  const { publicKey, keypair, connected, connectionMethod } = useWallet()
  const { balance } = useWalletBalance(publicKey)

  const [confirmation, setConfirmation] = useState<WalletTransferValues | null>(null)
  const [successTx, setSuccessTx] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const schemaWithBalance = useMemo(() => {
    return walletTransferSchema.extend({
      amount: walletTransferSchema.shape.amount.refine(
        (val) => val <= parseFloat(balance),
        'Insufficient balance'
      )
    })
  }, [balance])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, touchedFields, isValid },
  } = useForm<WalletTransferValues>({
    mode: 'onBlur',
    resolver: zodResolver(schemaWithBalance),
    defaultValues: {
      destination: '',
      amount: undefined,
      memo: '',
    },
  })

  const handleSendClick = (data: WalletTransferValues) => {
    setConfirmation({
      destination: data.destination.trim(),
      amount: data.amount,
      memo: data.memo?.trim() || '',
    })
  }

  const buildTransaction = async (): Promise<Transaction> => {
    const server = new Horizon.Server(HORIZON_URL)
    const account = await server.loadAccount(publicKey!)

    let txBuilder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    }).addOperation(
      Operation.payment({
        destination: confirmation!.destination,
        asset: Asset.native(),
        amount: confirmation!.amount.toString(),
      })
    )

    if (confirmation!.memo) {
      const memoText = confirmation!.memo
      if (memoText.length <= 28) {
        txBuilder = txBuilder.addMemo(Memo.text(memoText))
      } else {
        txBuilder = txBuilder.addMemo(Memo.text(memoText.substring(0, 28)))
      }
    }

    return txBuilder.setTimeout(30).build()
  }

  const handleConfirm = async () => {
    if (!confirmation) return

    if (connectionMethod === 'freighter') {
      if (!publicKey) return
    } else {
      if (!keypair) return
    }

    setSubmitError(null)
    setSubmitting(true)

    try {
      const transaction = await buildTransaction()

      let signedXdr: string
      if (connectionMethod === 'freighter') {
        const signedResult = await signTransactionWithFreighter(
          transaction.toEnvelope().toXDR('base64'),
          publicKey!
        )
        signedXdr = signedResult
      } else {
        transaction.sign(keypair!)
        signedXdr = transaction.toEnvelope().toXDR('base64')
      }

      const submitRes = await fetch(`${HORIZON_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tx: signedXdr }),
      })

      const submitData = await submitRes.json()

      if (!submitRes.ok) {
        throw new Error(submitData.extras?.result_codes?.transaction || 'Transaction submission failed')
      }

      const txHash = submitData.hash
      setSuccessTx(txHash)
      reset()
      setConfirmation(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send payment'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelConfirm = () => {
    setConfirmation(null)
  }

  if (!connected) {
    return (
      <div className={styles.container}>
        <p className={styles.disconnected}>Connect your wallet to send XLM.</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Send XLM</h3>

      <form onSubmit={handleSubmit(handleSendClick)} noValidate>
        <FormField
          label="Destination address"
          id="send-destination"
          placeholder="GABCD...1234"
          error={errors.destination?.message}
          isTouched={touchedFields.destination}
          disabled={Boolean(successTx) || submitting}
          className={styles.field}
          {...register('destination')}
        />

        <FormField
          label="Amount (XLM)"
          type="number"
          id="send-amount"
          step="0.0000001"
          min="0"
          placeholder="0.0"
          error={errors.amount?.message}
          isTouched={touchedFields.amount}
          helperText={`Available balance: ${parseFloat(balance).toFixed(7)} XLM`}
          disabled={Boolean(successTx) || submitting}
          className={styles.field}
          {...register('amount')}
        />

        <FormField
          label="Memo (optional)"
          id="send-memo"
          placeholder="Payment memo (max 28 chars)"
          maxLength={28}
          error={errors.memo?.message}
          isTouched={touchedFields.memo}
          disabled={Boolean(successTx) || submitting}
          className={styles.field}
          {...register('memo')}
        />

        <button
          type="submit"
          className={styles.sendButton}
          disabled={submitting || Boolean(successTx) || !isValid}
          style={{
            background: (!isValid || submitting) ? '#9ca3af' : undefined,
            cursor: (!isValid || submitting) ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Sending...' : 'Send'}
        </button>
      </form>

      {submitError && (
        <p className={styles.error} role="alert" style={{ marginTop: 12 }}>
          {submitError}
        </p>
      )}

      {successTx && (
        <div className={styles.successMessage} role="status">
          <p>Payment sent successfully!</p>
          <p className={styles.txHash}>
            TX: <code>{successTx}</code>
          </p>
          <button
            className={styles.dismissButton}
            onClick={() => setSuccessTx(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmation && (
        <div className={styles.overlay} onClick={handleCancelConfirm}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h3 id="confirm-title" className={styles.modalTitle}>
              Confirm Payment
            </h3>
            <div className={styles.modalBody}>
              <div className={styles.confirmRow}>
                <span className={styles.confirmLabel}>To:</span>
                <span className={styles.confirmValue}>{confirmation.destination}</span>
              </div>
              <div className={styles.confirmRow}>
                <span className={styles.confirmLabel}>Amount:</span>
                <span className={styles.confirmValue}>{confirmation.amount} XLM</span>
              </div>
              {confirmation.memo && (
                <div className={styles.confirmRow}>
                  <span className={styles.confirmLabel}>Memo:</span>
                  <span className={styles.confirmValue}>{confirmation.memo}</span>
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelButton}
                onClick={handleCancelConfirm}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className={styles.confirmButton}
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting
                  ? connectionMethod === 'freighter'
                    ? 'Signing with Freighter...'
                    : 'Signing & Sending...'
                  : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
