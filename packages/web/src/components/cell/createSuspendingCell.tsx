import { Suspense } from 'react'

import { QueryReference, useApolloClient } from '@apollo/client'

import { useBackgroundQuery, useReadQuery } from '../GraphQLHooksProvider'

/**
 * This is part of how we let users swap out their GraphQL client while staying compatible with Cells.
 */
import { CellErrorBoundary, FallbackProps } from './CellErrorBoundary'
import {
  CreateCellProps,
  DataObject,
  SuspendingSuccessProps,
  SuspenseCellQueryResult,
} from './cellTypes'
import { isDataEmpty } from './isCellEmpty'

type AnyObj = Record<string, unknown>
/**
 * Creates a Cell ~~ with Apollo Client only ~~
 * using the hooks useBackgroundQuery and useReadQuery
 *
 */
export function createSuspendingCell<
  CellProps extends AnyObj,
  CellVariables extends AnyObj
>(
  createCellProps: CreateCellProps<AnyObj, CellVariables> // 👈 AnyObj, because using CellProps causes a TS error
): React.FC<CellProps> {
  const {
    QUERY,
    beforeQuery = (props) => ({
      // By default, we assume that the props are the gql-variables.
      variables: props as unknown as CellVariables,
      /**
       * We're duplicating these props here due to a suspected bug in Apollo Client v3.5.4
       * (it doesn't seem to be respecting `defaultOptions` in `RedwoodApolloProvider`.)
       *
       * @see {@link https://github.com/apollographql/apollo-client/issues/9105}
       */
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true,
    }),
    afterQuery = (data) => ({ ...data }),
    isEmpty = isDataEmpty,
    Loading,
    Failure,
    Empty,
    Success,
    displayName = 'Cell',
  } = createCellProps
  function SuspendingSuccess(props: SuspendingSuccessProps) {
    const { queryRef, suspenseQueryResult, userProps } = props
    const { data, networkStatus } = useReadQuery<DataObject>(queryRef)
    const afterQueryData = afterQuery(data as DataObject)

    const queryResultWithNetworkStatus: SuspenseCellQueryResult = {
      ...suspenseQueryResult,
      networkStatus,
    }

    if (isEmpty(data, { isDataEmpty }) && Empty) {
      return (
        <Empty
          {...userProps}
          {...afterQueryData}
          queryResult={queryResultWithNetworkStatus}
        />
      )
    }

    return (
      <Success
        {...afterQueryData}
        {...userProps}
        queryResult={queryResultWithNetworkStatus}
      />
    )
  }

  SuspendingSuccess.displayName = displayName

  // @NOTE: Note that we are returning a HoC here!
  return (props: CellProps) => {
    /**
     * Right now, Cells don't render `children`.
     */
    const { children: _, ...variables } = props
    const options = beforeQuery(variables as CellProps)
    const query = typeof QUERY === 'function' ? QUERY(options) : QUERY
    const [queryRef, other] = useBackgroundQuery(query, options)

    const client = useApolloClient()

    const suspenseQueryResult: SuspenseCellQueryResult = {
      client,
      ...other,
      called: !!queryRef,
    }

    // @TODO(STREAMING) removed prerender handling here
    // Until we decide how/if we do prerendering

    const FailureComponent = ({ error, resetErrorBoundary }: FallbackProps) => {
      if (!Failure) {
        // So that it bubbles up to the nearest error boundary
        throw error
      }

      const queryResultWithErrorReset = {
        ...suspenseQueryResult,
        refetch: () => {
          resetErrorBoundary()
          return suspenseQueryResult.refetch?.()
        },
      }

      return (
        <Failure
          error={error}
          errorCode={error?.graphQLErrors?.[0]?.extensions?.['code'] as string}
          queryResult={queryResultWithErrorReset}
        />
      )
    }

    const wrapInSuspenseIfLoadingPresent = (
      suspendingSuccessElement: React.ReactNode,
      LoadingComponent: typeof Loading
    ) => {
      if (!LoadingComponent) {
        return suspendingSuccessElement
      }

      return (
        <Suspense
          fallback={
            <LoadingComponent {...props} queryResult={suspenseQueryResult} />
          }
        >
          {suspendingSuccessElement}
        </Suspense>
      )
    }

    return (
      <CellErrorBoundary renderFallback={FailureComponent}>
        {wrapInSuspenseIfLoadingPresent(
          <SuspendingSuccess
            userProps={props}
            queryRef={queryRef as QueryReference<DataObject>}
            suspenseQueryResult={suspenseQueryResult}
          />,
          Loading
        )}
      </CellErrorBoundary>
    )
  }
}
